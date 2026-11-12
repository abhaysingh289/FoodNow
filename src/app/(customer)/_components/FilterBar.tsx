"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Chip } from "@/components/ui";

export type FilterState = {
  q: string; // free-text search (restaurant, cuisine or dish name)
  toggles: string[]; // subset of halal | vegetarian | rating | fast | promo | open
  cuisines: string[];
  prices: number[];
  sort: string;
};

const TOGGLES: { key: string; label: string }[] = [
  { key: "halal", label: "Halal" },
  { key: "vegetarian", label: "Vegetarian" },
  { key: "rating", label: "4.0+ rating" },
  { key: "fast", label: "Under 30 min" },
  { key: "promo", label: "Deals" },
  { key: "open", label: "Open now" },
];

const SORTS: { value: string; label: string }[] = [
  { value: "relevance", label: "Recommended" },
  { value: "distance", label: "Nearest" },
  { value: "rating", label: "Top rated" },
  { value: "eta", label: "Fastest" },
];

function toQuery(s: FilterState): string {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  for (const t of s.toggles) p.set(t, "1");
  for (const c of s.cuisines) p.append("cuisine", c);
  for (const n of s.prices) p.append("price", String(n));
  if (s.sort !== "relevance") p.set("sort", s.sort);
  const q = p.toString();
  return q ? `/?${q}` : "/";
}

function toggleIn<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** URL search params are the source of truth; local state keeps rapid clicks consistent. */
export function FilterBar({ initial, cuisines }: { initial: FilterState; cuisines: string[] }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [query, setQuery] = useState(initial.q);

  // When the URL's filters change (our own replace landing, or e.g. the logo link back to "/"),
  // adopt them so the chips and the search box always match the results shown.
  const initialKey = toQuery(initial);
  const [syncedKey, setSyncedKey] = useState(initialKey);
  if (initialKey !== syncedKey) {
    setSyncedKey(initialKey);
    setState(initial);
    setQuery(initial.q);
  }

  /** Every filter change also carries the text currently in the search box. */
  function apply(patch: Partial<FilterState>) {
    const next = { ...state, q: query.trim(), ...patch };
    setState(next);
    router.replace(toQuery(next), { scroll: false });
  }

  return (
    <section aria-label="Filters" className="space-y-3">
      <form
        role="search"
        className="relative md:max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          apply({});
        }}
      >
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <label>
          <span className="sr-only">Search restaurants or dishes</span>
          <input
            type="search"
            data-testid="search-input"
            value={query}
            enterKeyHint="search"
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value === "" && state.q) apply({ q: "" });
            }}
            placeholder="Search restaurants or dishes"
            className="h-12 w-full rounded-chip border border-transparent bg-fill pl-12 pr-4 text-[15px] text-ink placeholder:text-muted focus:border-line-strong focus:bg-surface"
          />
        </label>
      </form>

      <div className="no-scrollbar -mx-4 -my-1.5 flex gap-2 overflow-x-auto px-4 py-1.5 md:-mx-6 md:px-6">
        <label className="relative flex shrink-0 items-center">
          <span className="sr-only">Sort by</span>
          <select
            data-testid="sort"
            value={state.sort}
            onChange={(e) => apply({ sort: e.target.value })}
            className="h-11 cursor-pointer appearance-none rounded-chip border border-line-strong bg-surface pl-4 pr-9 text-sm font-medium text-ink hover:bg-fill md:h-9"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <svg
            viewBox="0 0 20 20"
            className="pointer-events-none absolute right-3 h-4 w-4 text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </label>
        {TOGGLES.map((t) => (
          <Chip
            key={t.key}
            data-testid={`filter-${t.key}`}
            pressed={state.toggles.includes(t.key)}
            onClick={() => apply({ toggles: toggleIn(state.toggles, t.key) })}
          >
            {t.label}
          </Chip>
        ))}
        {[1, 2, 3, 4].map((n) => (
          <Chip
            key={n}
            data-testid={`filter-price-${n}`}
            aria-label={`Price level ${n}`}
            pressed={state.prices.includes(n)}
            onClick={() => apply({ prices: toggleIn(state.prices, n) })}
          >
            {"$".repeat(n)}
          </Chip>
        ))}
        {cuisines.length > 0 && <span aria-hidden="true" className="my-auto h-6 w-px shrink-0 bg-line-strong" />}
        {cuisines.map((c) => (
          <Chip
            key={c}
            data-testid={`filter-cuisine-${c}`}
            pressed={state.cuisines.includes(c)}
            onClick={() => apply({ cuisines: toggleIn(state.cuisines, c) })}
          >
            {c}
          </Chip>
        ))}
      </div>
    </section>
  );
}
