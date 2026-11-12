export type CountryCode = "HK" | "SG";

export const COUNTRY_CONFIG: Record<
  CountryCode,
  {
    code: CountryCode;
    name: string;
    currency: "HKD" | "SGD";
    symbol: string;
    taxRate: number;
    fee: { baseCents: number; perKmCents: number; capCents: number };
  }
> = {
  HK: {
    code: "HK",
    name: "Hong Kong",
    currency: "HKD",
    symbol: "HK$",
    taxRate: 0,
    fee: { baseCents: 1000, perKmCents: 300, capCents: 3500 },
  },
  SG: {
    code: "SG",
    name: "Singapore",
    currency: "SGD",
    symbol: "S$",
    taxRate: 0.09,
    fee: { baseCents: 200, perKmCents: 60, capCents: 700 },
  },
};

export function isCountryCode(x: unknown): x is CountryCode {
  return x === "HK" || x === "SG";
}
