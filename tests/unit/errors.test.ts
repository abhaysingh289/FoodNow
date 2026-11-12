import { describe, it, expect } from "vitest";
import * as E from "@/lib/errors";

const table: [new (m: string) => E.DomainError, string, number][] = [
  [E.InvalidTransition, "INVALID_TRANSITION", 409],
  [E.ConcurrentModification, "CONCURRENT_MODIFICATION", 409],
  [E.CartConflict, "CART_CONFLICT", 409],
  [E.RiderUnavailable, "RIDER_UNAVAILABLE", 409],
  [E.CountryMismatch, "COUNTRY_MISMATCH", 422],
  [E.ItemUnavailable, "ITEM_UNAVAILABLE", 422],
  [E.ModifierSelectionInvalid, "MODIFIER_SELECTION_INVALID", 422],
  [E.PromoInvalid, "PROMO_INVALID", 422],
  [E.RestaurantClosed, "RESTAURANT_CLOSED", 422],
  [E.PaymentAmountMismatch, "PAYMENT_AMOUNT_MISMATCH", 422],
  [E.NotFound, "NOT_FOUND", 404],
  [E.ValidationError, "VALIDATION_ERROR", 400],
];

describe("domain errors", () => {
  it("PromoInvalid carries message, code and status", () => {
    const e = new E.PromoInvalid("Minimum spend is HK$100.00");
    expect(e).toBeInstanceOf(E.DomainError);
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe("Minimum spend is HK$100.00");
    expect(e.code).toBe("PROMO_INVALID");
    expect(e.httpStatus).toBe(422);
  });

  it.each(table)("%o maps to %s / %i", (Cls, code, status) => {
    const e = new Cls("boom");
    expect(e).toBeInstanceOf(E.DomainError);
    expect(e.code).toBe(code);
    expect(e.httpStatus).toBe(status);
  });
});
