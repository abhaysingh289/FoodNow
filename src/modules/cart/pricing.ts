import { COUNTRY_CONFIG, type CountryCode } from "@/lib/countries";
import { formatMoney, roundCents } from "@/lib/money";

/** Delivery fee in cents: min(round(base + perKm * km), cap). */
export function deliveryFee(distanceKm: number, country: CountryCode): number {
  const { baseCents, perKmCents, capCents } = COUNTRY_CONFIG[country].fee;
  return Math.min(roundCents(baseCents + perKmCents * distanceKm), capCents);
}

export type PromoRule = {
  code: string;
  type: "PERCENT" | "FLAT" | "FREE_DELIVERY";
  value: number;
  minSubtotalCents: number;
  maxDiscountCents: number | null;
};

export type PriceBreakdown = {
  subtotalCents: number;
  discountCents: number;
  deliveryFeeCents: number;
  taxCents: number;
  totalCents: number;
  distanceKm: number;
  promoCode: string | null;
  promoError: string | null;
};

export function computePrice(input: {
  lines: { unitPriceCents: number; qty: number }[];
  promo: PromoRule | null;
  distanceKm: number;
  country: CountryCode;
}): PriceBreakdown {
  const { lines, promo, distanceKm, country } = input;
  const subtotalCents = lines.reduce((s, l) => s + l.unitPriceCents * l.qty, 0);
  let deliveryFeeCents = deliveryFee(distanceKm, country);
  let discountCents = 0;
  let promoCode: string | null = null;
  let promoError: string | null = null;

  if (promo) {
    if (subtotalCents < promo.minSubtotalCents) {
      promoError = `Minimum spend is ${formatMoney(promo.minSubtotalCents, country)}`;
    } else {
      promoCode = promo.code;
      if (promo.type === "PERCENT") {
        discountCents = roundCents((subtotalCents * promo.value) / 100);
        if (promo.maxDiscountCents !== null) {
          discountCents = Math.min(discountCents, promo.maxDiscountCents);
        }
      } else if (promo.type === "FLAT") {
        discountCents = Math.min(promo.value, subtotalCents);
      } else {
        deliveryFeeCents = 0;
      }
    }
  }

  const taxCents = roundCents((subtotalCents - discountCents) * COUNTRY_CONFIG[country].taxRate);
  return {
    subtotalCents,
    discountCents,
    deliveryFeeCents,
    taxCents,
    totalCents: subtotalCents - discountCents + deliveryFeeCents + taxCents,
    distanceKm,
    promoCode,
    promoError,
  };
}
