export type ErrorCode =
  | "INVALID_TRANSITION"
  | "CONCURRENT_MODIFICATION"
  | "CART_CONFLICT"
  | "COUNTRY_MISMATCH"
  | "ITEM_UNAVAILABLE"
  | "MODIFIER_SELECTION_INVALID"
  | "PROMO_INVALID"
  | "RESTAURANT_CLOSED"
  | "RIDER_UNAVAILABLE"
  | "PAYMENT_AMOUNT_MISMATCH"
  | "NOT_FOUND"
  | "VALIDATION_ERROR";

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

function define(code: ErrorCode, httpStatus: number) {
  return class extends DomainError {
    constructor(message: string) {
      super(code, httpStatus, message);
    }
  };
}

export class InvalidTransition extends define("INVALID_TRANSITION", 409) {}
export class ConcurrentModification extends define("CONCURRENT_MODIFICATION", 409) {}
export class CartConflict extends define("CART_CONFLICT", 409) {}
export class RiderUnavailable extends define("RIDER_UNAVAILABLE", 409) {}
export class CountryMismatch extends define("COUNTRY_MISMATCH", 422) {}
export class ItemUnavailable extends define("ITEM_UNAVAILABLE", 422) {}
export class ModifierSelectionInvalid extends define("MODIFIER_SELECTION_INVALID", 422) {}
export class PromoInvalid extends define("PROMO_INVALID", 422) {}
export class RestaurantClosed extends define("RESTAURANT_CLOSED", 422) {}
export class PaymentAmountMismatch extends define("PAYMENT_AMOUNT_MISMATCH", 422) {}
export class NotFound extends define("NOT_FOUND", 404) {}
export class ValidationError extends define("VALIDATION_ERROR", 400) {}
