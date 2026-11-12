"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card } from "@/components/ui";
import type { CountryCode } from "@/lib/countries";
import { formatMoney } from "@/lib/money";
import { formatTime } from "@/lib/time";
import {
  ACTION_LABELS,
  FAILURE_REASON_LABELS,
  type FailureReason,
  type OrderAction,
  type OrderStatus,
} from "@/modules/orders/stateMachine";

const ETA_STATUSES: OrderStatus[] = ["ACCEPTED", "RIDER_ASSIGNED", "PICKED_UP"];

export type OpsOrder = {
  id: string;
  restaurantName: string;
  createdAt: string;
  totalCents: number;
  country: string;
  status: OrderStatus;
  failureReason: FailureReason | null;
  etaMinutes: number | null;
  riderName: string | null;
  allowedActions: OrderAction[];
};
export type OpsRider = { id: string; name: string; vehicle: string; country: string; isAvailable: boolean };

const DANGER: OrderAction[] = ["REJECT", "NO_RIDER", "FAIL_DELIVERY", "CANCEL"];

export function OrderCard({
  order,
  riders,
  onDone,
  onError,
}: {
  order: OpsOrder;
  riders: OpsRider[];
  onDone: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const country = order.country as CountryCode;
  const [riderId, setRiderId] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: OrderAction) {
    setBusy(true);
    try {
      const res = await fetch(`/api/ops/orders/${order.id}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "ASSIGN_RIDER" ? { action, riderId } : { action }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
        const code = body?.error?.code;
        onError(
          code === "CONCURRENT_MODIFICATION" || code === "INVALID_TRANSITION"
            ? "Order already moved"
            : (body?.error?.message ?? "Something went wrong"),
        );
      }
    } catch {
      onError("Network error. Please try again.");
    } finally {
      setBusy(false);
      await onDone();
    }
  }

  const canAssign = order.allowedActions.includes("ASSIGN_RIDER");

  return (
    <Card data-testid={`ops-order-${order.id}`} className="space-y-2 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/ops/orders/${order.id}`} className="font-mono text-xs font-bold text-brand hover:underline">
          #{order.id.slice(-6)}
        </Link>
        <span className="text-xs text-muted">
          {order.country} · {formatTime(order.createdAt, country)}
        </span>
      </div>
      <p className="font-semibold leading-tight">{order.restaurantName}</p>
      <p className="font-semibold">{formatMoney(order.totalCents, country)}</p>
      {order.etaMinutes != null && ETA_STATUSES.includes(order.status) && (
        <p className="text-xs text-muted">ETA ~{order.etaMinutes} min</p>
      )}
      {order.riderName && <p className="text-xs text-muted">Rider: {order.riderName}</p>}
      {order.failureReason && (
        <p className="text-xs font-medium text-danger">{FAILURE_REASON_LABELS[order.failureReason]}</p>
      )}
      {canAssign && (
        <select
          data-testid="rider-picker"
          aria-label="Rider"
          value={riderId}
          onChange={(e) => setRiderId(e.target.value)}
          className="h-9 w-full rounded-control border border-line bg-surface px-2 text-sm"
        >
          <option value="">Choose rider</option>
          {riders.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.vehicle})
            </option>
          ))}
        </select>
      )}
      {order.allowedActions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {order.allowedActions.map((a) => (
            <Button
              key={a}
              size="sm"
              variant={DANGER.includes(a) ? "danger" : "primary"}
              data-testid={`ops-action-${a}`}
              disabled={busy || (a === "ASSIGN_RIDER" && !riderId)}
              onClick={() => void run(a)}
            >
              {ACTION_LABELS[a]}
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}
