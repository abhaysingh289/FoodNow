"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Price } from "@/components/ui";
import type { CountryCode } from "@/lib/countries";
import { formatMoney } from "@/lib/money";
import { formatTime } from "@/lib/time";
import type { FailureReason, OrderAction, OrderStatus } from "@/modules/orders/stateMachine";
import { callApi, type ApiError } from "./api";
import { OrderTimeline, type EventView } from "./OrderTimeline";
import { PaymentAction, type PaymentView } from "./PaymentAction";
import { statusMessage } from "./orderCopy";
import { StatusProgress } from "./StatusProgress";

/** The JSON shape of GET /api/orders/[id] that this screen reads. */
export type OrderView = {
  id: string;
  status: OrderStatus;
  failureReason: FailureReason | null;
  country: CountryCode;
  totalCents: number;
  etaMinutes: number | null;
  updatedAt: string;
  restaurant: { name: string };
  items: { id: string; nameSnapshot: string; qty: number }[];
  events: EventView[];
  payments: PaymentView[];
  refunds: { id: string; amountCents: number; status: string }[];
  delivery: { rider: { name: string; vehicle: string } | null } | null;
  allowedActions: OrderAction[];
};

const POLL_MS = 2000;
const STOP_POLLING: OrderStatus[] = ["DELIVERED", "CANCELLED", "REFUNDED"];
const ETA_STATUSES: OrderStatus[] = ["ACCEPTED", "RIDER_ASSIGNED", "PICKED_UP"];


function refundText(order: OrderView): string | null {
  const refunded = order.refunds.filter((r) => r.status === "SUCCEEDED").reduce((n, r) => n + r.amountCents, 0);
  const latest = order.refunds.at(-1)?.status;
  const state =
    order.status === "REFUNDED" || order.status === "REFUND_PENDING" || order.status === "REFUND_FAILED"
      ? order.status
      : latest === "SUCCEEDED"
        ? "REFUNDED"
        : latest === "FAILED"
          ? "REFUND_FAILED"
          : latest
            ? "REFUND_PENDING"
            : null;
  if (state === "REFUNDED") return `Refunded ${formatMoney(refunded, order.country)}`;
  if (state === "REFUND_FAILED") return "Refund delayed — we're on it";
  if (state === "REFUND_PENDING") return "Refund in progress";
  return null;
}

export function OrderTracker({ initial }: { initial: OrderView }) {
  const [order, setOrder] = useState(initial);
  const [hiddenPaymentId, setHiddenPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef({ issued: 0, applied: 0 });
  const orderId = initial.id;

  const refresh = useCallback(async () => {
    const n = ++seq.current.issued;
    try {
      const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as OrderView;
      if (n > seq.current.applied) {
        seq.current.applied = n; // ignore a slow response that was overtaken by a newer one
        setOrder(data);
      }
    } catch {
      // transient network error: the next poll retries
    }
  }, [orderId]);

  const polling = !STOP_POLLING.includes(order.status);
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [polling, refresh]);

  async function act(path: string) {
    setBusy(true);
    setError(null);
    const res = await callApi(`/api/orders/${orderId}/${path}`, "POST", {});
    setBusy(false);
    if (!res.ok) setError(res.error);
    await refresh();
  }

  const { status } = order;
  const rider = order.delivery?.rider ?? null;
  const refundedCents = order.refunds.filter((r) => r.status === "SUCCEEDED").reduce((n, r) => n + r.amountCents, 0);
  const message = statusMessage({
    status,
    failureReason: order.failureReason,
    country: order.country,
    rider,
    refundedCents,
  });
  const refund = refundText(order);
  const payment = order.payments.at(-1);
  const showPayment =
    status === "PENDING_PAYMENT" && payment?.status === "PENDING" && payment.id !== hiddenPaymentId;
  const can = (a: OrderAction) => order.allowedActions.includes(a);
  const showEta = (order.etaMinutes ?? 0) > 0 && ETA_STATUSES.includes(status);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/orders" className="text-sm font-semibold text-brand">
          ← Your orders
        </Link>
        <h1 className="font-display text-3xl font-extrabold">{order.restaurant.name}</h1>
      </div>

      <Card className="space-y-3 p-4">
        <p data-testid="order-status" role="status" className="text-lg font-bold">
          {message}
        </p>
        <StatusProgress status={status} />
        {showEta && (
          <p data-testid="order-eta" className="text-sm font-semibold">
            Arriving in ~{order.etaMinutes} min{" "}
            <span className="font-normal text-muted">
              (as of {formatTime(order.updatedAt, order.country)})
            </span>
          </p>
        )}
        {rider && (
          <p data-testid="rider-card" className="rounded-control bg-brand-soft p-3 text-sm">
            <span className="font-semibold">{rider.name}</span> · {rider.vehicle.toLowerCase()}
          </p>
        )}
        {refund && (
          <p data-testid="refund-status" className="rounded-control bg-brand-soft p-3 text-sm font-semibold">
            {refund}
          </p>
        )}
      </Card>

      {showPayment && payment && (
        <PaymentAction
          payment={payment}
          country={order.country}
          onDone={refresh}
          onLeavePending={() => setHiddenPaymentId(payment.id)}
        />
      )}

      {(can("RETRY_PAYMENT") || can("ABANDON") || can("CANCEL")) && (
        <div className="flex gap-2">
          {can("RETRY_PAYMENT") && (
            <Button data-testid="retry-payment" block disabled={busy} onClick={() => act("retry-payment")}>
              Retry payment
            </Button>
          )}
          {can("ABANDON") && (
            <Button data-testid="abandon-order" variant="secondary" block disabled={busy} onClick={() => act("abandon")}>
              Cancel order
            </Button>
          )}
          {can("CANCEL") && (
            <Button data-testid="cancel-order" variant="secondary" block disabled={busy} onClick={() => act("cancel")}>
              Cancel order
            </Button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" data-testid="order-error" className="rounded-control bg-danger-soft p-3 text-sm font-semibold text-danger">
          {error.message}
        </p>
      )}

      <Card className="p-4">
        <ul className="divide-y divide-line text-sm">
          {order.items.map((i) => (
            <li key={i.id} className="py-1.5">
              {i.qty} × {i.nameSnapshot}
            </li>
          ))}
        </ul>
        <p className="mt-2 flex justify-between border-t border-line pt-2 font-bold">
          <span>Total</span>
          <Price cents={order.totalCents} country={order.country} />
        </p>
      </Card>

      <section className="space-y-2">
        <h2 className="font-display text-xl font-bold">Timeline</h2>
        <OrderTimeline events={order.events} country={order.country} />
      </section>
    </div>
  );
}
