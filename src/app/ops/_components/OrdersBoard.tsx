"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui";
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
/** Columns that need attention get a muted red header; everything else stays neutral. */
const ALERT_COLUMNS: string[] = ["PAYMENT_FAILED", "REFUND_PENDING", "REFUND_FAILED"];

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

  const column = (testId: string, title: string, items: OpsOrder[], alert = false) => (
    <section key={testId} data-testid={testId} className="w-64 shrink-0">
      <h2
        className={cn(
          "mb-2 flex items-center justify-between rounded-control px-3 py-2 text-xs font-semibold uppercase tracking-wide",
          alert ? "bg-danger-soft text-danger" : "bg-fill text-muted",
        )}
      >
        {title}
        <span className="rounded-chip bg-surface px-2 py-0.5 tabular-nums text-ink">{items.length}</span>
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
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Orders</h1>
      {toast && (
        <div
          role="status"
          data-testid="ops-toast"
          className="mb-3 rounded-control bg-danger-soft px-4 py-2.5 text-sm font-medium text-danger"
        >
          {toast}
        </div>
      )}
      {orders === null ? (
        <p className="text-muted">Loading orders…</p>
      ) : (
        <div className="-mx-1.5 -mt-1.5 flex gap-3 overflow-x-auto px-1.5 pb-3 pt-1.5">
          {ACTIVE_COLUMNS.map((s) =>
            column(
              `ops-column-${s}`,
              s.replaceAll("_", " "),
              orders.filter((o) => o.status === s),
              ALERT_COLUMNS.includes(s),
            ),
          )}
          {column("ops-column-DONE", "Done (24h)", orders.filter((o) => DONE.includes(o.status)))}
        </div>
      )}
    </div>
  );
}
