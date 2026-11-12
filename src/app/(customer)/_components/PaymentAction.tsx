import type { CountryCode } from "@/lib/countries";
import { FakePaymentSheet } from "./FakePaymentSheet";

export type PaymentView = { id: string; provider: string; providerRef: string; amountCents: number; status: string };

/** Renders the provider-specific payment UI for a pending payment. Only the fake provider has one. */
export function PaymentAction({
  payment,
  country,
  onDone,
  onLeavePending,
}: {
  payment: PaymentView;
  country: CountryCode;
  onDone: () => void;
  onLeavePending: () => void;
}) {
  if (payment.provider === "fake") {
    return (
      <FakePaymentSheet
        providerRef={payment.providerRef}
        amountCents={payment.amountCents}
        country={country}
        onDone={onDone}
        onLeavePending={onLeavePending}
      />
    );
  }
  return (
    <p role="alert" data-testid="unsupported-payment" className="rounded-control bg-danger-soft p-3 text-sm font-semibold text-danger">
      Unsupported payment method
    </p>
  );
}
