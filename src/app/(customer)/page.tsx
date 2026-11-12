import { getSession } from "@/lib/session";
import { getHomeGroups, listRestaurants, type RestaurantFilters } from "@/modules/catalog";
import { FilterBar, type FilterState } from "./_components/FilterBar";
import { RestaurantCard } from "./_components/RestaurantCard";

type Params = Record<string, string | string[] | undefined>;

const TOGGLE_KEYS = ["halal", "vegetarian", "rating", "fast", "promo", "open"] as const;
const SORTS = ["relevance", "distance", "rating", "eta"] as const;

const many = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

function parseFilters(p: Params): { state: FilterState; filters: RestaurantFilters } {
  const toggles = TOGGLE_KEYS.filter((k) => p[k] !== undefined);
  const cuisines = many(p.cuisine);
  const prices = many(p.price)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 4);
  const q = (many(p.q)[0] ?? "").trim();
  const sortParam = many(p.sort)[0];
  const sort = SORTS.find((s) => s === sortParam) ?? "relevance";
  const has = (k: string) => toggles.some((t) => t === k);
  return {
    state: { q, toggles: [...toggles], cuisines, prices, sort },
    filters: {
      q: q || undefined,
      halal: has("halal") || undefined,
      vegetarian: has("vegetarian") || undefined,
      minRating: has("rating") ? 4 : undefined,
      maxEta: has("fast") ? 30 : undefined,
      hasPromo: has("promo") || undefined,
      openNow: has("open") || undefined,
      cuisines: cuisines.length ? cuisines : undefined,
      priceLevels: prices.length ? prices : undefined,
      sort,
    },
  };
}

export default async function HomePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const session = await getSession();
  const { state, filters } = parseFilters(params);
  const filtered =
    state.q !== "" ||
    state.toggles.length > 0 ||
    state.cuisines.length > 0 ||
    state.prices.length > 0 ||
    state.sort !== "relevance";

  const [groups, results] = await Promise.all([
    getHomeGroups(session.country, session.address),
    listRestaurants(session.country, session.address, filters),
  ]);
  const cuisines = groups.filter((g) => g.key.startsWith("cuisine:")).map((g) => g.title);

  return (
    <div className="space-y-8">
      <h1 className="sr-only">Restaurants delivering to {session.address.label}</h1>

      <FilterBar initial={state} cuisines={cuisines} />

      {!filtered &&
        groups
          .filter((g) => g.restaurants.length > 0)
          .map((g) => (
            <section key={g.key} data-testid={`group-${g.key}`} aria-label={g.title} className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">{g.title}</h2>
              <div className="no-scrollbar -mx-4 -my-1.5 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 py-1.5 md:-mx-6 md:scroll-px-6 md:px-6">
                {g.restaurants.map((r) => (
                  <RestaurantCard
                    key={r.id}
                    restaurant={r}
                    country={session.country}
                    testId={`group-card-${g.key}-${r.id}`}
                    compact
                  />
                ))}
              </div>
            </section>
          ))}

      <section aria-label="All restaurants" className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {filtered ? `${results.length} ${results.length === 1 ? "restaurant" : "restaurants"}` : "All restaurants"}
        </h2>
        {results.length === 0 && (
          <p className="rounded-card bg-fill px-6 py-10 text-center text-muted">
            Nothing matches those filters. Try removing one.
          </p>
        )}
        <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((r) => (
            <RestaurantCard key={r.id} restaurant={r} country={session.country} testId={`restaurant-card-${r.id}`} />
          ))}
        </div>
      </section>
    </div>
  );
}
