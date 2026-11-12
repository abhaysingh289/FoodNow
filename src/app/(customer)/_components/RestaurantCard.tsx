import Image from "next/image";
import Link from "next/link";
import { Card, Price, cn } from "@/components/ui";
import type { CountryCode } from "@/lib/countries";
import type { RestaurantCardData } from "@/modules/catalog";

export function RestaurantCard({
  restaurant: r,
  country,
  testId,
  compact = false,
}: {
  restaurant: RestaurantCardData;
  country: CountryCode;
  testId: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={`/r/${r.id}`}
      data-testid={testId}
      aria-label={r.isOpen ? r.name : `${r.name} (closed)`}
      className={cn("block shrink-0 rounded-card", compact && "w-60")}
    >
      <Card className={cn("overflow-hidden transition-shadow hover:shadow-md", !r.isOpen && "opacity-60 grayscale")}>
        <div className="relative h-28 bg-brand-soft">
          <Image src={r.imageUrl} alt="" fill unoptimized className="object-cover" />
          {!r.isOpen && (
            <span className="absolute left-3 top-3 rounded-chip bg-ink px-2.5 py-1 text-xs font-semibold text-white">
              Closed
            </span>
          )}
          {r.hasPromo && r.isOpen && (
            <span className="absolute left-3 top-3 rounded-chip bg-accent px-2.5 py-1 text-xs font-bold text-ink">
              Deal
            </span>
          )}
        </div>
        <div className="space-y-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-lg font-bold leading-tight">{r.name}</h3>
            <span className="shrink-0 rounded-chip bg-brand-soft px-2 py-0.5 text-sm font-semibold text-brand-strong">
              {r.rating.toFixed(1)} ★
            </span>
          </div>
          <p className="truncate text-sm text-muted">
            {r.cuisines.join(" · ")} · {"$".repeat(r.priceLevel)}
          </p>
          <p className="text-sm text-muted">
            {r.etaMinutes} min · {r.distanceKm.toFixed(1)} km · <Price cents={r.deliveryFeeCents} country={country} />{" "}
            delivery
          </p>
        </div>
      </Card>
    </Link>
  );
}
