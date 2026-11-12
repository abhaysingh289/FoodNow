import Image from "next/image";
import Link from "next/link";
import { Price, buttonClasses, cn } from "@/components/ui";
import type { CountryCode } from "@/lib/countries";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { getSession } from "@/lib/session";
import { listOrdersForUser } from "@/modules/orders";
import { ReorderButton } from "../_components/ReorderButton";

const TAB_CLASS =
  "-mb-px inline-flex h-11 items-center border-b-2 px-1 text-[15px] font-semibold transition-colors";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "history" ? "history" : "active";
  const session = await getSession();
  const orders = await listOrdersForUser(session.user.id, tab);
  // Presentational only: the restaurant photo for each row's thumbnail.
  const photos = new Map(
    (
      await prisma.order.findMany({
        where: { id: { in: orders.map((o) => o.id) } },
        select: { id: true, restaurant: { select: { imageUrl: true } } },
      })
    ).map((o) => [o.id, o.restaurant.imageUrl]),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-[26px] font-bold leading-tight tracking-tight md:text-[28px]">Your orders</h1>

      <div role="tablist" className="flex gap-6 border-b border-line">
        <Link
          href="/orders"
          role="tab"
          aria-selected={tab === "active"}
          data-testid="tab-active"
          className={cn(TAB_CLASS, tab === "active" ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}
        >
          Active
        </Link>
        <Link
          href="/orders?tab=history"
          role="tab"
          aria-selected={tab === "history"}
          data-testid="tab-history"
          className={cn(TAB_CLASS, tab === "history" ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}
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
        <ul className="divide-y divide-line">
          {orders.map((o) => {
            const photo = photos.get(o.id);
            return (
              <li key={o.id} data-testid={`order-row-${o.id}`} className="flex items-start gap-4 py-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-control bg-fill">
                  {photo && <Image src={photo} alt="" fill unoptimized className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <Link href={`/orders/${o.id}`} className="block rounded-control">
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-semibold">{o.restaurantName}</span>
                      <Price cents={o.totalCents} country={o.country as CountryCode} className="font-semibold" />
                    </span>
                    <span className="mt-0.5 flex justify-between gap-3 text-[13px] text-muted">
                      <span className="first-letter:uppercase">{o.status.replaceAll("_", " ").toLowerCase()}</span>
                      <time dateTime={o.createdAt.toISOString()}>
                        {formatDateTime(o.createdAt, o.country as CountryCode)}
                      </time>
                    </span>
                  </Link>
                  {tab === "history" && <ReorderButton orderId={o.id} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
