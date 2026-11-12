import { COUNTRY_CONFIG, type CountryCode } from "@/lib/countries";

/** Round a computed amount to integer cents (half-up for positives). */
export function roundCents(n: number): number {
  return Math.round(n);
}

export function formatMoney(cents: number, country: CountryCode): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${COUNTRY_CONFIG[country].symbol}${whole}.${frac}`;
}
