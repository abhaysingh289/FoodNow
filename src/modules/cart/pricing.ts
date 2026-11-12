import { COUNTRY_CONFIG, type CountryCode } from "@/lib/countries";
import { roundCents } from "@/lib/money";

/** Delivery fee in cents: min(round(base + perKm * km), cap). */
export function deliveryFee(distanceKm: number, country: CountryCode): number {
  const { baseCents, perKmCents, capCents } = COUNTRY_CONFIG[country].fee;
  return Math.min(roundCents(baseCents + perKmCents * distanceKm), capCents);
}
