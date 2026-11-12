import Image from "next/image";
import Link from "next/link";
import { Price, cn } from "@/components/ui";
import type { CountryCode } from "@/lib/countries";
import type { RestaurantCardData } from "@/modules/catalog";

/** Photo-first restaurant card: 16:9 photo, then name + rating, then one muted meta line. */
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
      className={cn("group block min-w-0 rounded-card", compact && "w-72 shrink-0 snap-start md:w-80")}
    >
      <div className="relative aspect-video overflow-hidden rounded-card bg-fill">
        <Image
          src={r.imageUrl}
          alt=""
          fill
          unoptimized
          className={cn(
            "object-cover transition-transform duration-300 group-hover:scale-[1.03]",
            !r.isOpen && "opacity-60 grayscale",
          )}
        />
        {r.hasPromo && r.isOpen && (
          <span className="absolute left-3 top-3 rounded-chip bg-brand px-2.5 py-1 text-xs font-bold text-white">
            Promo
          </span>
        )}
        {!r.isOpen && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/30">
            <span className="rounded-chip bg-ink/85 px-3 py-1.5 text-sm font-semibold text-white">Closed</span>
          </span>
        )}
      </div>
      <div className="mt-2.5 space-y-0.5 px-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className={cn("truncate text-base font-semibold", !r.isOpen && "text-muted")}>{r.name}</h3>
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            <span aria-hidden="true" className="text-ink">
              ★
            </span>{" "}
            {r.rating.toFixed(1)}
            <span className="sr-only"> rating</span>
          </span>
        </div>
        {/* Only the cuisine list truncates, so distance, ETA and fee always stay visible. */}
        <p className="flex min-w-0 text-[13px] text-muted">
          <span className="min-w-0 truncate">{r.cuisines.join(", ")}</span>
          <span className="shrink-0 whitespace-pre">
            {" · "}
            <span className="tabular-nums">{r.distanceKm.toFixed(1)} km</span>
            {" · "}
            <span className="tabular-nums">{r.etaMinutes} min</span>
            {" · "}
            <Price cents={r.deliveryFeeCents} country={country} /> delivery
          </span>
        </p>
      </div>
    </Link>
  );
}
