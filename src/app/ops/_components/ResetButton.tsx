"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Sheet } from "@/components/ui";

export function ResetButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ops/reset", { method: "POST" });
      if (!res.ok) {
        setError("Reset failed. Please try again.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="danger" data-testid="reset-data" onClick={() => setOpen(true)}>
        Reset data
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Reset data" variant="center" testId="reset-dialog">
        <div className="space-y-3 p-6">
          <h2 className="pr-10 text-lg font-bold tracking-tight">Reset all data?</h2>
          <p className="text-sm text-muted">
            This wipes all orders, payments, carts and webhooks, then reseeds the demo data. It cannot be undone.
          </p>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" data-testid="reset-confirm" disabled={busy} onClick={() => void confirm()}>
              {busy ? "Resetting…" : "Wipe and reseed"}
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
