import { describe, it, expect } from "vitest";
import { formatMoney, roundCents } from "@/lib/money";
import { COUNTRY_CONFIG, isCountryCode } from "@/lib/countries";

describe("money", () => {
  it("formats cents with the country symbol", () => {
    expect(formatMoney(10000, "HK")).toBe("HK$100.00");
    expect(formatMoney(850, "SG")).toBe("S$8.50");
    expect(formatMoney(0, "SG")).toBe("S$0.00");
  });

  it("rounds half up and absorbs float noise", () => {
    expect(roundCents(112.5)).toBe(113);
    expect(roundCents(225.00000000000003)).toBe(225);
  });
});

describe("country config", () => {
  it("has verbatim tax and fee values", () => {
    expect(COUNTRY_CONFIG.SG.taxRate).toBe(0.09);
    expect(COUNTRY_CONFIG.HK.fee).toEqual({ baseCents: 1000, perKmCents: 300, capCents: 3500 });
    expect(COUNTRY_CONFIG.SG.fee).toEqual({ baseCents: 200, perKmCents: 60, capCents: 700 });
  });

  it("guards country codes", () => {
    expect(isCountryCode("HK")).toBe(true);
    expect(isCountryCode("SG")).toBe(true);
    expect(isCountryCode("US")).toBe(false);
    expect(isCountryCode(undefined)).toBe(false);
  });
});
