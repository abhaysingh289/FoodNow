import Link from "next/link";
import { Card, Price, buttonClasses, cn } from "@/components/ui";
import { getSession } from "@/lib/session";
import { listOrdersForUser } from "@/modules/orders";
import { ReorderButton } from "../_components/ReorderButton";

const TAB_CLASS = "flex-1 rounded-chip px-4 py-2 text-center text-sm font-semibold transition-colors";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "history" ? "history" : "active";
  const session = await getSession();
  const orders = await listOrdersForUser(session.user.id, tab);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-extrabold">Your orders</h1>

      <div role="tablist" className="flex rounded-chip border border-line bg-surface p-0.5">
        <Link
          href="/orders"
          role="tab"
          aria-selected={tab === "active"}
          data-testid="tab-active"
          className={cn(TAB_CLASS, tab === "active" ? "bg-ink text-white" : "text-muted hover:text-ink")}
        >
          Active
        </Link>
        <Link
          href="/orders?tab=history"
          role="tab"
          aria-selected={tab === "history"}
          data-testid="tab-history"
          className={cn(TAB_CLASS, tab === "history" ? "bg-ink text-white" : "text-muted hover:text-ink")}
        >
          History
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="space-y-4 py-12 text-center">
          <p className="text-muted">{tab === "active" ? "No active orders right now." : "No past orders yet."}</p>
          <Link href="/" className={buttonClasses()}>
            Browse restaurants
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Card data-testid={`order-row-${o.id}`} className="space-y-2 p-4">
                <Link href={`/orders/${o.id}`} className="block">
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-semibold">{o.restaurantName}</span>
                    <Price cents={o.totalCents} country={o.country as "HK" | "SG"} className="font-semibold" />
                  </span>
                  <span className="mt-0.5 flex justify-between gap-3 text-sm text-muted">
                    <span>{o.status.replaceAll("_", " ").toLowerCase()}</span>
                    <time dateTime={o.createdAt.toISOString()}>
                      {o.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                  </span>
                </Link>
                {tab === "history" && <ReorderButton orderId={o.id} />}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
