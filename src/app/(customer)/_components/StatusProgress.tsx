import { cn } from "@/components/ui";
import type { OrderStatus } from "@/modules/orders/stateMachine";

const STEPS = [
  ["PLACED", "Placed"],
  ["ACCEPTED", "Preparing"],
  ["RIDER_ASSIGNED", "Rider assigned"],
  ["PICKED_UP", "On the way"],
  ["DELIVERED", "Delivered"],
] as const;

const FAILED: OrderStatus[] = ["PAYMENT_FAILED", "CANCELLED", "REFUND_PENDING", "REFUNDED", "REFUND_FAILED"];

/** Vertical stepper: grey rail, completed steps dark, the current step a tomato dot with a bold label. */
export function StatusProgress({ status }: { status: OrderStatus }) {
  if (FAILED.includes(status)) {
    return (
      <div
        data-testid="status-progress"
        data-state="cancelled"
        className="flex items-center gap-3 rounded-card bg-danger-soft px-4 py-3"
      >
        <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-danger" />
        <p className="text-sm font-semibold text-danger">{status === "PAYMENT_FAILED" ? "Payment failed" : "Cancelled"}</p>
      </div>
    );
  }
  const current = STEPS.findIndex(([s]) => s === status); // -1 while payment is still pending
  return (
    <ol data-testid="status-progress" data-state="active">
      {STEPS.map(([step, label], i) => {
        const done = i < current;
        const isCurrent = i === current;
        return (
          <li
            key={step}
            className="relative flex items-start gap-3 pb-5 last:pb-0"
            aria-current={isCurrent ? "step" : undefined}
          >
            {i < STEPS.length - 1 && (
              <span aria-hidden="true" className="absolute bottom-0 left-[9px] top-5 w-0.5 bg-line" />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                done && "bg-ink text-white",
                isCurrent && "bg-brand ring-4 ring-brand-soft",
                !done && !isCurrent && "border-2 border-line-strong bg-surface",
              )}
            >
              {done && (
                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {isCurrent && <span className="h-2 w-2 rounded-full bg-white" />}
            </span>
            <span
              className={cn(
                "text-[15px] leading-6",
                isCurrent ? "font-bold text-ink" : done ? "text-ink" : "text-muted",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
