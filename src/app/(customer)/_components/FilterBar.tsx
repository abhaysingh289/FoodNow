"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Chip } from "@/components/ui";

export type FilterState = {
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

  function apply(next: FilterState) {
    setState(next);
    router.replace(toQuery(next), { scroll: false });
  }

  return (
    <section aria-label="Filters" className="space-y-2">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TOGGLES.map((t) => (
          <Chip
            key={t.key}
            data-testid={`filter-${t.key}`}
            pressed={state.toggles.includes(t.key)}
            onClick={() => apply({ ...state, toggles: toggleIn(state.toggles, t.key) })}
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
            onClick={() => apply({ ...state, prices: toggleIn(state.prices, n) })}
          >
            {"$".repeat(n)}
          </Chip>
        ))}
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {cuisines.map((c) => (
          <Chip
            key={c}
            data-testid={`filter-cuisine-${c}`}
            pressed={state.cuisines.includes(c)}
            onClick={() => apply({ ...state, cuisines: toggleIn(state.cuisines, c) })}
          >
            {c}
          </Chip>
        ))}
      </div>
      <label className="flex items-center justify-end gap-2 text-sm text-muted">
        Sort by
        <select
          data-testid="sort"
          value={state.sort}
          onChange={(e) => apply({ ...state, sort: e.target.value })}
          className="h-9 rounded-control border border-line bg-surface px-2 text-ink"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
