"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderStatus } from "@/modules/orders/stateMachine";
import { usePolling } from "./usePolling";
import { OrderCard, type OpsOrder, type OpsRider } from "./OrderCard";

const ACTIVE_COLUMNS: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAYMENT_FAILED",
  "PLACED",
  "ACCEPTED",
  "RIDER_ASSIGNED",
  "PICKED_UP",
  "REFUND_PENDING",
  "REFUND_FAILED",
];
const DONE: OrderStatus[] = ["DELIVERED", "CANCELLED", "REFUNDED"];

export function OrdersBoard() {
  const { data: orders, refresh } = usePolling<OpsOrder[]>("/api/ops/orders");
  const { data: hk } = usePolling<OpsRider[]>("/api/ops/riders?country=HK");
  const { data: sg } = usePolling<OpsRider[]>("/api/ops/riders?country=SG");
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const available = (country: string) => ((country === "HK" ? hk : sg) ?? []).filter((r) => r.isAvailable);

  const column = (testId: string, title: string, items: OpsOrder[]) => (
    <section key={testId} data-testid={testId} className="w-64 shrink-0 rounded-card border border-line bg-canvas/60 p-2">
      <h2 className="mb-2 flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-muted">
        {title}
        <span className="rounded-chip bg-line px-2 py-0.5 text-ink">{items.length}</span>
      </h2>
      <div className="space-y-2">
        {items.map((o) => (
          <OrderCard key={o.id} order={o} riders={available(o.country)} onDone={refresh} onError={showToast} />
        ))}
      </div>
    </section>
  );

  return (
    <div className="min-w-0">
      <h1 className="mb-3 font-display text-2xl font-bold">Orders</h1>
      {toast && (
        <div
          role="status"
          data-testid="ops-toast"
          className="mb-3 rounded-control bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
        >
          {toast}
        </div>
      )}
      {orders === null ? (
        <p className="text-muted">Loading orders…</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {ACTIVE_COLUMNS.map((s) =>
            column(`ops-column-${s}`, s.replaceAll("_", " "), orders.filter((o) => o.status === s)),
          )}
          {column("ops-column-DONE", "Done (24h)", orders.filter((o) => DONE.includes(o.status)))}
        </div>
      )}
    </div>
  );
}
