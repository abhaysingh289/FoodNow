import type { CountryCode } from "@/lib/countries";
import { formatMoney } from "@/lib/money";
import { FAILURE_REASON_LABELS, STATUS_MESSAGES, type FailureReason, type OrderStatus } from "@/modules/orders/stateMachine";

/** Spec §10.1 customer copy with its {placeholders} filled in. */
export function statusMessage(input: {
  status: OrderStatus;
  failureReason: FailureReason | null;
  country: CountryCode;
  rider: { name: string; vehicle: string } | null;
  refundedCents: number;
}): string {
  return STATUS_MESSAGES[input.status]
    .replace("{rider}", input.rider?.name ?? "Your rider")
    .replace("{vehicle}", (input.rider?.vehicle ?? "vehicle").toLowerCase())
    .replace("{reason}", input.failureReason ? FAILURE_REASON_LABELS[input.failureReason] : "order cancelled")
    .replace("{amount}", formatMoney(input.refundedCents, input.country));
}
