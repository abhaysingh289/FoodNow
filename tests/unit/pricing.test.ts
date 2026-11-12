import { describe, expect, it } from "vitest";
import { computePrice, deliveryFee, type PromoRule } from "@/modules/cart/pricing";

const HK = "HK", SG = "SG";
const WELCOME20: PromoRule = { code: "WELCOME20", type: "PERCENT", value: 20, minSubtotalCents: 10000, maxDiscountCents: 5000 };
const FREEDEL_HK: PromoRule = { code: "FREEDEL", type: "FREE_DELIVERY", value: 0, minSubtotalCents: 8000, maxDiscountCents: null };
const SAVE5: PromoRule = { code: "SAVE5", type: "FLAT", value: 500, minSubtotalCents: 2500, maxDiscountCents: null };
const FREEDEL_SG: PromoRule = { ...FREEDEL_HK, minSubtotalCents: 1500 };

describe("computePrice", () => {
  it("prices HK without promo", () => {
    expect(computePrice({ lines: [{ unitPriceCents: 8800, qty: 1 }, { unitPriceCents: 4200, qty: 2 }], promo: null, distanceKm: 3.2, country: HK }))
      .toMatchObject({ subtotalCents: 17200, discountCents: 0, deliveryFeeCents: 1960, taxCents: 0, totalCents: 19160 });
  });
  it("caps delivery fee", () => {
    expect(deliveryFee(10, HK)).toBe(3500);
  });
  it("applies percent promo and its cap", () => {
    expect(computePrice({ lines: [{ unitPriceCents: 17200, qty: 1 }], promo: WELCOME20, distanceKm: 3.2, country: HK }))
      .toMatchObject({ discountCents: 3440, totalCents: 15720, promoCode: "WELCOME20", promoError: null });
    expect(computePrice({ lines: [{ unitPriceCents: 30000, qty: 1 }], promo: WELCOME20, distanceKm: 0, country: HK }).discountCents).toBe(5000);
  });
  it("reports minimum spend instead of discounting", () => {
    expect(computePrice({ lines: [{ unitPriceCents: 9000, qty: 1 }], promo: WELCOME20, distanceKm: 1, country: HK }))
      .toMatchObject({ discountCents: 0, promoCode: null, promoError: "Minimum spend is HK$100.00" });
  });
  it("applies flat promo with SG tax on discounted subtotal", () => {
    expect(computePrice({ lines: [{ unitPriceCents: 3000, qty: 1 }], promo: SAVE5, distanceKm: 2.5, country: SG }))
      .toMatchObject({ deliveryFeeCents: 350, discountCents: 500, taxCents: 225, totalCents: 3075 });
  });
  it("rounds tax half-up", () => {
    expect(computePrice({ lines: [{ unitPriceCents: 1250, qty: 1 }], promo: null, distanceKm: 0, country: SG }).taxCents).toBe(113);
  });
  it("free delivery zeroes the fee", () => {
    expect(computePrice({ lines: [{ unitPriceCents: 1500, qty: 1 }], promo: FREEDEL_SG, distanceKm: 4, country: SG }))
      .toMatchObject({ deliveryFeeCents: 0, taxCents: 135, totalCents: 1635 });
  });
});
