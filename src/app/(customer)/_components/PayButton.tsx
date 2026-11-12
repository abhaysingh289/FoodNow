"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { callApiData } from "./api";
import { useHydrated } from "./useHydrated";

export function PayButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const ready = useHydrated();
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    const res = await callApiData<{ orderId: string }>("/api/orders", "POST");
    if (!res.ok) {
      setBusy(false);
      setError(res.error.message);
      return;
    }
    router.push(`/orders/${res.data.orderId}`); // stay busy while navigating so a second click can't re-submit
  }

  return (
    <div className="space-y-2">
      <Button data-testid="pay-button" size="lg" block disabled={busy || !ready} onClick={pay}>
        {busy ? "Placing order…" : "Pay"}
      </Button>
      {error && (
        <p role="alert" data-testid="checkout-error" className="rounded-control bg-danger-soft p-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
