import type { Address } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { CountryCode } from "@/lib/countries";
import {
  CartConflict,
  ItemUnavailable,
  ModifierSelectionInvalid,
  NotFound,
  PromoInvalid,
  RestaurantClosed,
  ValidationError,
} from "@/lib/errors";
import { haversineKm } from "@/modules/catalog";
import { computePrice, type PriceBreakdown, type PromoRule } from "./pricing";

export type CartView = {
  restaurant: { id: string; name: string; country: CountryCode; isOpen: boolean } | null;
  lines: {
    id: string;
    menuItemId: string;
    name: string;
    qty: number;
    unitPriceCents: number;
    options: { id: string; name: string; priceDeltaCents: number }[];
    note: string | null;
    isAvailable: boolean;
  }[];
  price: PriceBreakdown;
};

const MAX_QTY = 20;

function assertQty(qty: number, min: number): void {
  if (!Number.isInteger(qty) || qty < min || qty > MAX_QTY) {
    throw new ValidationError(`Quantity must be between ${min} and ${MAX_QTY}`);
  }
}

function ids(json: unknown): string[] {
  return Array.isArray(json) ? (json as string[]) : [];
}

async function findPromo(code: string, country: string): Promise<PromoRule | null> {
  const p = await prisma.promo.findUnique({ where: { code_country: { code, country } } });
  if (!p) return null;
  return {
    code: p.code,
    type: p.type as PromoRule["type"],
    value: p.value,
    minSubtotalCents: p.minSubtotalCents,
    maxDiscountCents: p.maxDiscountCents,
  };
}

const EMPTY_PRICE: PriceBreakdown = {
  subtotalCents: 0,
  discountCents: 0,
  deliveryFeeCents: 0,
  taxCents: 0,
  totalCents: 0,
  distanceKm: 0,
  promoCode: null,
  promoError: null,
};

export async function getCart(userId: string, address: Address): Promise<CartView> {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { restaurant: true, items: { include: { menuItem: true }, orderBy: { id: "asc" } } },
  });
  if (!cart || !cart.restaurant || cart.items.length === 0) {
    return { restaurant: null, lines: [], price: { ...EMPTY_PRICE } };
  }
  const restaurant = cart.restaurant;
  const country = restaurant.country as CountryCode;
  const allOptionIds = cart.items.flatMap((i) => ids(i.selectedOptionIds));
  const options = await prisma.modifierOption.findMany({ where: { id: { in: allOptionIds } } });
  const byId = new Map(options.map((o) => [o.id, o]));

  const lines = cart.items.map((i) => {
    const opts = ids(i.selectedOptionIds)
      .map((id) => byId.get(id))
      .filter((o): o is NonNullable<typeof o> => !!o)
      .map((o) => ({ id: o.id, name: o.name, priceDeltaCents: o.priceDeltaCents }));
    return {
      id: i.id,
      menuItemId: i.menuItemId,
      name: i.menuItem.name,
      qty: i.qty,
      unitPriceCents: i.menuItem.priceCents + opts.reduce((s, o) => s + o.priceDeltaCents, 0),
      options: opts,
      note: i.note,
      isAvailable: i.menuItem.isAvailable,
    };
  });

  let promo: PromoRule | null = null;
  let notFound = false;
  if (cart.promoCode) {
    promo = await findPromo(cart.promoCode, restaurant.country);
    notFound = promo === null;
  }
  const price = computePrice({
    lines,
    promo,
    country,
    distanceKm: haversineKm(restaurant, address),
  });
  if (notFound) price.promoError = "Promo code not found";

  return {
    restaurant: { id: restaurant.id, name: restaurant.name, country, isOpen: restaurant.isOpen },
    lines,
    price,
  };
}

export async function addItem(
  userId: string,
  input: { menuItemId: string; qty: number; optionIds: string[]; note?: string; replaceCart?: boolean },
): Promise<void> {
  assertQty(input.qty, 1);
  const item = await prisma.menuItem.findUnique({
    where: { id: input.menuItemId },
    include: { category: { include: { restaurant: true } }, groups: { include: { options: true } } },
  });
  if (!item) throw new NotFound("Menu item not found");
  const restaurant = item.category.restaurant;
  if (!item.isAvailable) throw new ItemUnavailable(`${item.name} is unavailable`);
  if (!restaurant.isOpen) throw new RestaurantClosed(`${restaurant.name} is closed`);

  const optionIds = [...new Set(input.optionIds)].sort();
  if (optionIds.length !== input.optionIds.length) {
    throw new ModifierSelectionInvalid("Duplicate options selected");
  }
  const known = new Set(item.groups.flatMap((g) => g.options.map((o) => o.id)));
  if (optionIds.some((id) => !known.has(id))) {
    throw new ModifierSelectionInvalid("Option does not belong to this item");
  }
  for (const g of item.groups) {
    const n = g.options.filter((o) => optionIds.includes(o.id)).length;
    const min = g.required ? Math.max(g.minSelect, 1) : 0;
    if (n < min || n > g.maxSelect) {
      throw new ModifierSelectionInvalid(`Invalid selection for ${g.name}`);
    }
  }

  const note = input.note?.trim() ? input.note.trim() : null;

  await prisma.$transaction(async (tx) => {
    let cart = await tx.cart.findUnique({ where: { userId }, include: { items: true } });
    if (!cart) {
      cart = await tx.cart.create({ data: { userId }, include: { items: true } });
    }
    if (cart.restaurantId && cart.items.length > 0 && cart.restaurantId !== restaurant.id) {
      if (!input.replaceCart) {
        const other = await tx.restaurant.findUnique({ where: { id: cart.restaurantId } });
        throw new CartConflict(`Your cart has items from ${other?.name ?? "another restaurant"}`);
      }
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      cart.items = [];
    }
    const match = cart.items.find(
      (i) =>
        i.menuItemId === item.id &&
        (i.note ?? "") === (note ?? "") &&
        ids(i.selectedOptionIds).slice().sort().join("|") === optionIds.join("|"),
    );
    if (match) {
      const qty = match.qty + input.qty;
      if (qty > MAX_QTY) throw new ValidationError(`Quantity must be between 1 and ${MAX_QTY}`);
      await tx.cartItem.update({ where: { id: match.id }, data: { qty } });
    } else {
      await tx.cartItem.create({
        data: { cartId: cart.id, menuItemId: item.id, qty: input.qty, selectedOptionIds: optionIds, note },
      });
    }
    await tx.cart.update({ where: { id: cart.id }, data: { restaurantId: restaurant.id } });
  });
}

export async function updateQty(userId: string, lineId: string, qty: number): Promise<void> {
  assertQty(qty, 0);
  const cart = await prisma.cart.findUnique({ where: { userId } });
  const line = cart ? await prisma.cartItem.findFirst({ where: { id: lineId, cartId: cart.id } }) : null;
  if (!cart || !line) throw new NotFound("Cart line not found");
  if (qty > 0) {
    await prisma.cartItem.update({ where: { id: lineId }, data: { qty } });
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.cartItem.delete({ where: { id: lineId } });
    const left = await tx.cartItem.count({ where: { cartId: cart.id } });
    if (left === 0) await tx.cart.update({ where: { id: cart.id }, data: { restaurantId: null } });
  });
}

export async function setPromo(userId: string, code: string | null, country: CountryCode): Promise<void> {
  let normalized: string | null = null;
  if (code !== null) {
    normalized = code.trim().toUpperCase();
    if (!(await findPromo(normalized, country))) throw new PromoInvalid("Promo code not found");
  }
  await prisma.cart.upsert({
    where: { userId },
    create: { userId, promoCode: normalized },
    update: { promoCode: normalized },
  });
}

export async function clearCart(userId: string): Promise<void> {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) return;
  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
    prisma.cart.update({ where: { id: cart.id }, data: { restaurantId: null, promoCode: null } }),
  ]);
}
