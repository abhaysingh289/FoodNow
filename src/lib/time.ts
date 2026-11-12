import { COUNTRY_CONFIG, type CountryCode } from "@/lib/countries";

/** Wall-clock HH:mm (24h) in the country's timezone, so server and client render the same text. */
export function formatTime(date: Date | string, country: CountryCode): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: COUNTRY_CONFIG[country].timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(date));
}

/** "12 Nov 2026, 14:05" in the country's timezone. */
export function formatDateTime(date: Date | string, country: CountryCode): string {
  const d = new Intl.DateTimeFormat("en-GB", {
    timeZone: COUNTRY_CONFIG[country].timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
  return d + ", " + formatTime(date, country);
}
