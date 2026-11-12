import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  CartConflict, ItemUnavailable, ModifierSelectionInvalid, PromoInvalid, ValidationError,
} from "@/lib/errors";
import { addItem, clearCart, getCart, setPromo, updateQty } from "@/modules/cart";

let MEI_HK_ADDR: Awaited<ReturnType<typeof prisma.address.findUniqueOrThrow>>;

beforeEach(async () => {
  const { resetDb } = await import("../helpers/db");
  await resetDb();
  MEI_HK_ADDR = await prisma.address.findUniqueOrThrow({ where: { id: "a_mei_hk" } });
});

describe("cart", () => {
  it("merges identical lines regardless of option order and prices modifiers", async () => {
    await addItem("u_mei", { menuItemId: "hk_gd_wonton", qty: 1, optionIds: ["opt_wonton_large", "opt_wonton_extra"] });
    await addItem("u_mei", { menuItemId: "hk_gd_wonton", qty: 2, optionIds: ["opt_wonton_extra", "opt_wonton_large"] });
    const cart = await getCart("u_mei", MEI_HK_ADDR);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]).toMatchObject({ qty: 3, unitPriceCents: 8500 });
    expect(cart.lines[0].options.map((o) => o.id).sort()).toEqual(["opt_wonton_extra", "opt_wonton_large"]);
  });

  it("rejects invalid additions", async () => {
    await expect(addItem("u_mei", { menuItemId: "hk_gd_wonton", qty: 1, optionIds: [] })).rejects.toBeInstanceOf(ModifierSelectionInvalid);
    await expect(addItem("u_mei", { menuItemId: "hk_gd_lobster", qty: 1, optionIds: [] })).rejects.toBeInstanceOf(ItemUnavailable);
    await expect(addItem("u_mei", { menuItemId: "hk_gd_har_gow", qty: 21, optionIds: [] })).rejects.toBeInstanceOf(ValidationError);
    await expect(addItem("u_mei", { menuItemId: "hk_gd_har_gow", qty: 0, optionIds: [] })).rejects.toBeInstanceOf(ValidationError);
  });

  it("handles restaurant conflicts and replaceCart", async () => {
    await addItem("u_mei", { menuItemId: "hk_gd_har_gow", qty: 1, optionIds: [] });
    await expect(addItem("u_mei", { menuItemId: "sg_tl_chicken_rice", qty: 1, optionIds: [] })).rejects.toBeInstanceOf(CartConflict);
    await addItem("u_mei", { menuItemId: "sg_tl_chicken_rice", qty: 1, optionIds: [], replaceCart: true });
    expect((await getCart("u_mei", MEI_HK_ADDR)).restaurant!.id).toBe("sg_tampines_laksa");
  });

  it("rejects items from a closed restaurant", async () => {
    const closed = await prisma.menuItem.findFirstOrThrow({ where: { category: { restaurantId: "hk_midnight_ramen" } } });
    const { RestaurantClosed } = await import("@/lib/errors");
    await expect(addItem("u_mei", { menuItemId: closed.id, qty: 1, optionIds: [] })).rejects.toBeInstanceOf(RestaurantClosed);
  });

  it("shows promo as not applied when an edit drops below the minimum", async () => {
    await addItem("u_mei", { menuItemId: "hk_gd_har_gow", qty: 3, optionIds: [] });
    await setPromo("u_mei", "WELCOME20", "HK");
    expect((await getCart("u_mei", MEI_HK_ADDR)).price.discountCents).toBe(2520);
    const line = (await getCart("u_mei", MEI_HK_ADDR)).lines[0];
    await updateQty("u_mei", line.id, 2);
    expect((await getCart("u_mei", MEI_HK_ADDR)).price).toMatchObject({ discountCents: 0, promoError: "Minimum spend is HK$100.00" });
    await expect(setPromo("u_mei", "SAVE5", "HK")).rejects.toBeInstanceOf(PromoInvalid);
  });

  it("empties the cart when the last line is removed, keeping promo", async () => {
    await addItem("u_mei", { menuItemId: "hk_gd_har_gow", qty: 3, optionIds: [] });
    await setPromo("u_mei", "WELCOME20", "HK");
    const line = (await getCart("u_mei", MEI_HK_ADDR)).lines[0];
    await updateQty("u_mei", line.id, 0);
    const cart = await getCart("u_mei", MEI_HK_ADDR);
    expect(cart.restaurant).toBeNull();
    expect(cart.lines).toEqual([]);
    expect(cart.price).toMatchObject({ subtotalCents: 0, deliveryFeeCents: 0, totalCents: 0, distanceKm: 0 });
    expect((await prisma.cart.findUniqueOrThrow({ where: { userId: "u_mei" } })).promoCode).toBe("WELCOME20");
    await expect(updateQty("u_mei", line.id, 1)).rejects.toThrow();
  });

  it("validates qty on updateQty, and clearCart empties", async () => {
    await addItem("u_mei", { menuItemId: "hk_gd_har_gow", qty: 1, optionIds: [] });
    const line = (await getCart("u_mei", MEI_HK_ADDR)).lines[0];
    await expect(updateQty("u_mei", line.id, 21)).rejects.toBeInstanceOf(ValidationError);
    await clearCart("u_mei");
    expect((await getCart("u_mei", MEI_HK_ADDR)).lines).toEqual([]);
  });

  it("prices with no promo when the stored code no longer resolves", async () => {
    await addItem("u_mei", { menuItemId: "hk_gd_har_gow", qty: 3, optionIds: [] });
    await prisma.cart.update({ where: { userId: "u_mei" }, data: { promoCode: "GONE" } });
    expect((await getCart("u_mei", MEI_HK_ADDR)).price).toMatchObject({ discountCents: 0, promoCode: null, promoError: "Promo code not found" });
  });
});
