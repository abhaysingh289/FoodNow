import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "@/components/ui";
import { OrderTimeline, type EventView } from "@/app/(customer)/_components/OrderTimeline";
import type { CountryCode } from "@/lib/countries";
import { NotFound } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { getOrderDetail } from "@/modules/orders";

export const dynamic = "force-dynamic";

/** Muted status tint: green when delivered, red for failures and refunds, neutral otherwise. */
function statusTone(status: string): string {
  if (status === "DELIVERED") return "bg-ok-soft text-ok";
  if (status === "CANCELLED" || status.includes("FAILED") || status.startsWith("REFUND")) return "bg-danger-soft text-danger";
  return "bg-fill text-ink";
}

const SECTION = "py-5 first:pt-0";
const ROW = "rounded-control border border-line p-3";

export default async function OpsOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let o;
  try {
    o = await getOrderDetail(id);
  } catch (err) {
    if (err instanceof NotFound) notFound();
    throw err;
  }
  const country = o.country as CountryCode;
  const events: EventView[] = o.events.map((e) => ({
    id: e.id,
    toStatus: e.toStatus,
    actor: e.actor,
    note: e.note,
    createdAt: e.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-4">
      <Link href="/ops" className="text-sm font-semibold text-ink hover:underline">
        ← Back to board
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          Order #{o.id.slice(-6)} · {o.restaurant.name}
        </h1>
        <span
          data-testid="ops-detail-status"
          className={cn("rounded-chip px-3 py-1 text-sm font-semibold", statusTone(o.status))}
        >
          {o.status.replaceAll("_", " ")}
        </span>
        {o.flags.map((f) => (
          <span
            key={f}
            data-testid={`flag-${f}`}
            className="rounded-chip bg-danger-soft px-3 py-1 text-sm font-bold text-danger"
          >
            {f.replaceAll("_", " ")}
          </span>
        ))}
        <span className="text-sm text-muted">
          {formatMoney(o.totalCents, country)} · {o.country}
        </span>
      </div>

      <div className="grid gap-8 border-t border-line pt-5 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 text-base font-semibold">Timeline</h2>
          <OrderTimeline events={events} country={country} />
        </section>

        <div className="divide-y divide-line">
          <section className={SECTION}>
            <h2 className="mb-3 text-base font-semibold">Payment attempts</h2>
            {o.payments.length === 0 ? (
              <p className="text-sm text-muted">None.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {o.payments.map((p) => (
                  <li key={p.id} data-testid="payment-row" className={ROW}>
                    <span className="font-semibold">{p.status}</span> · {formatMoney(p.amountCents, country)}
                    <p className="break-all font-mono text-xs text-muted">ref {p.providerRef}</p>
                    <p className="break-all font-mono text-xs text-muted">key {p.idempotencyKey}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={SECTION}>
            <h2 className="mb-3 text-base font-semibold">Refund attempts</h2>
            {o.refunds.length === 0 ? (
              <p className="text-sm text-muted">None.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {o.refunds.map((r) => (
                  <li key={r.id} data-testid="refund-row" className={ROW}>
                    <span className="font-semibold">{r.status}</span> · {formatMoney(r.amountCents, country)}
                    <p className="break-all font-mono text-xs text-muted">ref {r.refundRef ?? "-"}</p>
                    <p className="break-all font-mono text-xs text-muted">key {r.idempotencyKey}</p>
                    {r.failureReason && <p className="text-xs text-danger">{r.failureReason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={SECTION}>
            <h2 className="mb-3 text-base font-semibold">Webhook log</h2>
            {o.webhookLogs.length === 0 ? (
              <p className="text-sm text-muted">None.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {o.webhookLogs.map((l) => (
                  <li key={l.id} data-testid="webhook-row" className={ROW}>
                    <span className="font-semibold">{l.result}</span> · {l.eventType}
                    <p className="break-all font-mono text-xs text-muted">{l.eventId}</p>
                    <p className="text-xs text-muted">{formatDateTime(l.receivedAt, country)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
