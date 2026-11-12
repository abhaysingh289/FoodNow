"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { callApiData } from "./api";
import { useHydrated } from "./useHydrated";

export function ReorderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const ready = useHydrated();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reorder() {
    setBusy(true);
    setError(null);
    const res = await callApiData<{ skipped: string[] }>("/api/cart/reorder", "POST", { orderId });
    if (!res.ok) {
      setBusy(false);
      setError(res.error.message); // e.g. RESTAURANT_CLOSED
      return;
    }
    const qs = new URLSearchParams();
    for (const name of res.data.skipped) qs.append("skipped", name);
    router.push(qs.size > 0 ? `/cart?${qs}` : "/cart");
  }

  return (
    <div>
      <Button data-testid="reorder" variant="secondary" size="sm" disabled={busy || !ready} onClick={reorder}>
        Reorder
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
