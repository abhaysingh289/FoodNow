"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Price } from "@/components/ui";
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
  // A payment start that failed leaves PENDING_PAYMENT with nothing to wait on: offer the resumable retry.
  const canRetry =
    can("RETRY_PAYMENT") ||
    (status === "PENDING_PAYMENT" && !order.payments.some((p) => p.status === "PENDING"));
  const showEta = (order.etaMinutes ?? 0) > 0 && ETA_STATUSES.includes(status);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/orders"
        className="-ml-2 inline-flex h-11 items-center rounded-chip px-2 text-sm font-semibold text-ink hover:bg-fill md:h-9"
      >
        ← Your orders
      </Link>
      <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight md:text-[28px]">{order.restaurant.name}</h1>

      <div className="mt-4 divide-y divide-line border-y border-line">
        <section aria-label="Order status" className="space-y-5 py-5">
          <div className="space-y-1">
            <p data-testid="order-status" role="status" className="text-xl font-bold leading-snug tracking-tight">
              {message}
            </p>
            {showEta && (
              <p data-testid="order-eta" className="text-[15px] font-semibold">
                Arriving in ~{order.etaMinutes} min{" "}
                <span className="font-normal text-muted">
                  (as of {formatTime(order.updatedAt, order.country)})
                </span>
              </p>
            )}
          </div>
          <StatusProgress status={status} />
          {rider && (
            <p data-testid="rider-card" className="flex items-center gap-3 rounded-card bg-fill p-3 text-sm">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-base font-bold"
              >
                {rider.name.charAt(0)}
              </span>
              <span>
                <span className="block text-[13px] text-muted">Your rider</span>
                <span className="font-semibold">{rider.name}</span> · {rider.vehicle.toLowerCase()}
              </span>
            </p>
          )}
          {refund && (
            <p data-testid="refund-status" className="rounded-card bg-fill p-4 text-sm font-semibold">
              {refund}
            </p>
          )}

          {showPayment && payment && (
            <PaymentAction
              payment={payment}
              country={order.country}
              onDone={refresh}
              onLeavePending={() => setHiddenPaymentId(payment.id)}
            />
          )}

          {(canRetry || can("ABANDON") || can("CANCEL")) && (
            <div className="flex gap-2">
              {canRetry && (
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
        </section>

        <section aria-label="Your order" className="py-5">
          <h2 className="mb-2 text-lg font-semibold tracking-tight">Your order</h2>
          <ul className="space-y-1.5 text-[15px]">
            {order.items.map((i) => (
              <li key={i.id}>
                <span className="tabular-nums text-muted">{i.qty} ×</span> {i.nameSnapshot}
              </li>
            ))}
          </ul>
          <p className="mt-3 flex justify-between border-t border-line pt-3 font-bold">
            <span>Total</span>
            <Price cents={order.totalCents} country={order.country} />
          </p>
        </section>

        <section aria-label="Timeline" className="space-y-3 py-5">
          <h2 className="text-lg font-semibold tracking-tight">Timeline</h2>
          <OrderTimeline events={order.events} country={order.country} />
        </section>
      </div>
    </div>
  );
}
