import type { Order, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { COUNTRY_CONFIG } from "@/lib/countries";
import {
  CartConflict, CountryMismatch, ItemUnavailable, NotFound, PromoInvalid, RestaurantClosed,
} from "@/lib/errors";
import { getCart } from "@/modules/cart";
import type { ClientAction } from "@/modules/payments/provider";
import { startPayment } from "@/modules/payments/service";
import { transition } from "./transition";

/** Re-prices the cart server-side, snapshots it into an order, then starts the first payment attempt. */
export async function placeOrder(
  userId: string,
  addressId: string,
): Promise<{ orderId: string; clientAction: ClientAction }> {
  const address = await prisma.address.findFirst({ where: { id: addressId, userId } });
  if (!address) throw new NotFound("Address not found");

  const cart = await getCart(userId, address);
  if (!cart.restaurant || cart.lines.length === 0) throw new CartConflict("Your cart is empty");
  if (!cart.restaurant.isOpen) throw new RestaurantClosed(`${cart.restaurant.name} is closed`);
  const unavailable = cart.lines.find((l) => !l.isAvailable);
  if (unavailable) throw new ItemUnavailable(`${unavailable.name} is no longer available`);
  if (cart.restaurant.country !== address.country) {
    throw new CountryMismatch("This restaurant does not deliver to the selected address");
  }
  if (cart.price.promoError) throw new PromoInvalid(cart.price.promoError);

  const { price, restaurant, lines } = cart;
  const orderId = await prisma.$transaction(async (tx) => {
    // Claim the cart first: a concurrent second submit finds nothing to delete and fails.
    const row = await tx.cart.findUnique({ where: { userId } });
    const claimed = row ? await tx.cartItem.deleteMany({ where: { cartId: row.id } }) : { count: 0 };
    if (!row || claimed.count === 0) throw new CartConflict("Your cart is empty");
    if (claimed.count !== lines.length) throw new CartConflict("Your cart changed, please review it");
    await tx.cart.update({ where: { id: row.id }, data: { restaurantId: null, promoCode: null } });

    const order = await tx.order.create({
      data: {
        userId,
        restaurantId: restaurant.id,
        country: restaurant.country,
        currency: COUNTRY_CONFIG[restaurant.country].currency,
        addressSnapshot: address as unknown as Prisma.InputJsonValue,
        status: "PENDING_PAYMENT",
        subtotalCents: price.subtotalCents,
        discountCents: price.discountCents,
        deliveryFeeCents: price.deliveryFeeCents,
        taxCents: price.taxCents,
        totalCents: price.totalCents,
        promoCode: price.promoCode,
        distanceKm: price.distanceKm,
        items: {
          create: lines.map((l) => ({
            menuItemId: l.menuItemId,
            nameSnapshot: l.name,
            unitPriceCents: l.unitPriceCents,
            qty: l.qty,
            optionsSnapshot: l.options.map((o) => ({ name: o.name, priceDeltaCents: o.priceDeltaCents })),
            note: l.note,
          })),
        },
        events: { create: { fromStatus: null, toStatus: "PENDING_PAYMENT", actor: "CUSTOMER" } },
        delivery: { create: {} },
      },
    });
    return order.id;
  });

  const clientAction = await startPayment(orderId);
  return { orderId, clientAction };
}

async function ownedOrder(orderId: string, userId: string): Promise<Order> {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
  if (!order) throw new NotFound("Order not found");
  return order;
}

export async function retryPayment(orderId: string, userId: string): Promise<ClientAction> {
  await ownedOrder(orderId, userId);
  await transition(orderId, "RETRY_PAYMENT", "CUSTOMER");
  return startPayment(orderId);
}

export async function abandonOrder(orderId: string, userId: string): Promise<Order> {
  await ownedOrder(orderId, userId);
  return transition(orderId, "ABANDON", "CUSTOMER");
}
