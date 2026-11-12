"use client";

import { useState } from "react";
import { Button, Price, Sheet } from "@/components/ui";
import type { CountryCode } from "@/lib/countries";
import { callApi } from "./api";

type Outcome = "succeed" | "fail" | "pending";

/** Stand-in for a real provider's payment UI. It resolves the intent only through its three buttons. */
export function FakePaymentSheet({
  providerRef,
  amountCents,
  country,
  onDone,
  onLeavePending,
}: {
  providerRef: string;
  amountCents: number;
  country: CountryCode;
  onDone: () => void;
  onLeavePending: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(outcome: Outcome) {
    setBusy(true);
    setError(null);
    const res = await callApi(`/api/fake-provider/intents/${encodeURIComponent(providerRef)}`, "POST", { outcome });
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    if (outcome === "pending") onLeavePending();
    onDone();
  }

  return (
    <Sheet open dismissible={false} onClose={() => {}} title="Test payment" testId="fake-sheet">
      <div className="space-y-4 p-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">Fake payment provider</p>
          <h2 className="font-display text-xl font-bold">
            Pay <Price cents={amountCents} country={country} data-testid="fake-amount" />
          </h2>
          <p className="text-sm text-muted">No real money moves. Pick how this payment should end.</p>
        </div>
        <div className="space-y-2">
          <Button data-testid="fake-approve" block disabled={busy} onClick={() => decide("succeed")}>
            Approve payment
          </Button>
          <Button data-testid="fake-decline" variant="danger" block disabled={busy} onClick={() => decide("fail")}>
            Decline payment
          </Button>
          <Button data-testid="fake-pending" variant="secondary" block disabled={busy} onClick={() => decide("pending")}>
            Leave pending
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
