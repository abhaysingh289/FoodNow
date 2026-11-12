"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { usePolling } from "./usePolling";
import type { OpsRider } from "./OrderCard";

type Rider = OpsRider & { currentOrderId: string | null };

function Group({ country, onError }: { country: "HK" | "SG"; onError: (m: string | null) => void }) {
  const { data: riders, refresh } = usePolling<Rider[]>(`/api/ops/riders?country=${country}`);

  async function toggle(r: Rider) {
    onError(null);
    try {
      const res = await fetch(`/api/ops/riders/${r.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isAvailable: !r.isAvailable }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
        onError(data?.error?.message ?? "Something went wrong");
      }
    } catch {
      onError("Network error. Please try again.");
    }
    await refresh();
  }

  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{country}</h3>
      <ul className="divide-y divide-line">
        {(riders ?? []).map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span>
              <span className="font-semibold">{r.name}</span> <span className="text-muted">({r.vehicle})</span>
              <br />
              <span className={r.isAvailable ? "text-xs text-ok" : "text-xs text-muted"}>
                {r.isAvailable ? "Available" : r.currentOrderId ? `Busy · #${r.currentOrderId.slice(-6)}` : "Unavailable"}
              </span>
            </span>
            <Button size="sm" variant="secondary" data-testid={`rider-toggle-${r.id}`} onClick={() => void toggle(r)}>
              {r.isAvailable ? "Set busy" : "Set available"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RidersPanel() {
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="space-y-3 py-4">
      <h2 className="text-base font-semibold">Riders</h2>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Group country="HK" onError={setError} />
      <Group country="SG" onError={setError} />
    </section>
  );
}
