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

export function StatusProgress({ status }: { status: OrderStatus }) {
  if (FAILED.includes(status)) {
    return (
      <div data-testid="status-progress" data-state="cancelled" className="space-y-1">
        <div className="h-2 rounded-chip bg-danger" />
        <p className="text-sm font-semibold text-danger">{status === "PAYMENT_FAILED" ? "Payment failed" : "Cancelled"}</p>
      </div>
    );
  }
  const current = STEPS.findIndex(([s]) => s === status); // -1 while payment is still pending
  return (
    <ol data-testid="status-progress" data-state="active" className="flex gap-1.5">
      {STEPS.map(([step, label], i) => (
        <li key={step} className="min-w-0 flex-1 space-y-1" aria-current={i === current ? "step" : undefined}>
          <div className={cn("h-2 rounded-chip", i <= current ? "bg-ok" : "bg-line")} />
          <p className={cn("truncate text-[11px]", i === current ? "font-bold text-ink" : "text-muted")}>{label}</p>
        </li>
      ))}
    </ol>
  );
}
