import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Price } from "@/components/ui";
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
    <div className="space-y-5">
      <Link href="/" className="inline-block text-sm font-semibold text-brand">
        ← All restaurants
      </Link>

      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="relative h-36 bg-brand-soft">
          <Image src={r.imageUrl} alt="" fill unoptimized className="object-cover" />
        </div>
        <div className="space-y-1 p-4">
          <h1 className="font-display text-3xl font-extrabold leading-tight">{r.name}</h1>
          <p className="text-muted">{r.cuisines.join(" · ")}</p>
          {r.description && <p className="text-sm text-muted">{r.description}</p>}
          <p className="pt-1 text-sm font-medium">
            {r.rating.toFixed(1)} ★ · {r.etaMinutes} min · {r.distanceKm.toFixed(1)} km ·{" "}
            <Price cents={r.deliveryFeeCents} country={session.country} /> delivery
          </p>
        </div>
      </div>

      {!r.isOpen && (
        <p role="status" className="rounded-card bg-ink p-3 text-center text-sm font-semibold text-white">
          This restaurant is closed right now. You can browse the menu, but ordering is paused.
        </p>
      )}

      {r.categories.map((c) => (
        <section key={c.id} aria-label={c.name} className="space-y-1">
          <h2 className="font-display text-xl font-bold">{c.name}</h2>
          <div className="divide-y divide-line rounded-card border border-line bg-surface">
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
