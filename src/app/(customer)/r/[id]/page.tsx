import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Price, cn } from "@/components/ui";
import { NotFound } from "@/lib/errors";
import { getSession } from "@/lib/session";
import { getRestaurant } from "@/modules/catalog";
import { ItemSheet } from "../../_components/ItemSheet";

export default async function RestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  let r;
  try {
    r = await getRestaurant(id, session.address);
  } catch (err) {
    if (err instanceof NotFound) notFound();
    throw err;
  }

  return (
    <div>
      <Link
        href="/"
        className="-ml-2 mb-2 inline-flex h-11 items-center rounded-chip px-2 text-sm font-semibold text-ink hover:bg-fill md:h-9"
      >
        ← All restaurants
      </Link>

      <div className="relative -mx-4 aspect-video overflow-hidden bg-fill md:mx-0 md:aspect-[16/5] md:rounded-card">
        <Image
          src={r.imageUrl}
          alt=""
          fill
          unoptimized
          priority
          className={cn("object-cover", !r.isOpen && "grayscale")}
        />
      </div>

      <div className="space-y-2 border-b border-line py-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight md:text-[28px]">{r.name}</h1>
          <span
            className={cn(
              "rounded-chip px-2.5 py-0.5 text-xs font-semibold",
              r.isOpen ? "bg-ok-soft text-ok" : "bg-fill-strong text-ink",
            )}
          >
            {r.isOpen ? "Open now" : "Closed"}
          </span>
        </div>
        <p className="text-muted">{r.cuisines.join(", ")}</p>
        {r.description && <p className="max-w-2xl text-sm text-muted">{r.description}</p>}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-sm">
          <span className="font-semibold tabular-nums">
            <span aria-hidden="true">★</span> {r.rating.toFixed(1)}
            <span className="sr-only"> rating</span>
          </span>
          <span aria-hidden="true" className="text-line-strong">
            ·
          </span>
          <span className="tabular-nums">{r.etaMinutes} min</span>
          <span aria-hidden="true" className="text-line-strong">
            ·
          </span>
          <span className="tabular-nums">{r.distanceKm.toFixed(1)} km</span>
          <span aria-hidden="true" className="text-line-strong">
            ·
          </span>
          <span>
            <Price cents={r.deliveryFeeCents} country={session.country} /> delivery
          </span>
        </p>
      </div>

      {!r.isOpen && (
        <p role="status" className="mt-4 rounded-card bg-fill p-4 text-sm font-medium text-ink">
          This restaurant is closed right now. You can browse the menu, but ordering is paused.
        </p>
      )}

      {r.categories.length > 1 && (
        <nav
          aria-label="Menu categories"
          className="sticky top-[var(--topbar-h)] z-20 -mx-4 border-b border-line bg-surface/95 backdrop-blur md:-mx-6"
        >
          <ul className="no-scrollbar flex gap-1 overflow-x-auto px-2 md:px-4">
            {r.categories.map((c) => (
              <li key={c.id} className="shrink-0">
                <a
                  href={`#cat-${c.id}`}
                  className="inline-flex h-12 items-center whitespace-nowrap rounded-chip px-3 text-sm font-medium text-muted hover:text-ink"
                >
                  {c.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {r.categories.map((c) => (
        <section
          key={c.id}
          id={`cat-${c.id}`}
          aria-label={c.name}
          className="scroll-mt-[calc(var(--topbar-h)+3.5rem)] pt-7"
        >
          <h2 className="text-lg font-semibold tracking-tight">{c.name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-10">
            {c.items.map((item) => (
              <ItemSheet
                key={item.id}
                country={session.country}
                restaurantOpen={r.isOpen}
                item={{
                  id: item.id,
                  name: item.name,
                  description: item.description,
                  priceCents: item.priceCents,
                  imageUrl: item.imageUrl,
                  isAvailable: item.isAvailable,
                  groups: item.groups.map((g) => ({
                    id: g.id,
                    name: g.name,
                    required: g.required,
                    minSelect: g.minSelect,
                    maxSelect: g.maxSelect,
                    options: g.options.map((o) => ({ id: o.id, name: o.name, priceDeltaCents: o.priceDeltaCents })),
                  })),
                }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
