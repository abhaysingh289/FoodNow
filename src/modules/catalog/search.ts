export type RestaurantFilters = {
  q?: string;
  cuisines?: string[];
  minRating?: number;
  priceLevels?: number[];
  maxEta?: number;
  halal?: boolean;
  vegetarian?: boolean;
  hasPromo?: boolean;
  openNow?: boolean;
  sort?: "relevance" | "distance" | "rating" | "eta";
};

export type RestaurantCardData = {
  id: string;
  name: string;
  cuisines: string[];
  tags: string[];
  rating: number;
  priceLevel: number;
  imageUrl: string;
  isOpen: boolean;
  hasPromo: boolean;
  distanceKm: number;
  etaMinutes: number;
  deliveryFeeCents: number;
};

/** Card data plus the item names used for text search. */
export type SearchableCard = RestaurantCardData & { itemNames: string[] };

function relevanceScore(r: RestaurantCardData): number {
  return r.rating / (1 + r.distanceKm / 5);
}

export function filterRestaurants<T extends SearchableCard>(rows: T[], f: RestaurantFilters): T[] {
  const q = f.q?.trim().toLowerCase();
  return rows.filter((r) => {
    if (q) {
      const hit =
        r.name.toLowerCase().includes(q) ||
        r.cuisines.some((c) => c.toLowerCase().includes(q)) ||
        r.itemNames.some((n) => n.toLowerCase().includes(q));
      if (!hit) return false;
    }
    if (f.cuisines?.length && !r.cuisines.some((c) => f.cuisines!.includes(c))) return false;
    if (f.minRating !== undefined && r.rating < f.minRating) return false;
    if (f.priceLevels?.length && !f.priceLevels.includes(r.priceLevel)) return false;
    if (f.maxEta !== undefined && r.etaMinutes > f.maxEta) return false;
    if (f.halal && !r.tags.includes("halal")) return false;
    if (f.vegetarian && !r.tags.includes("vegetarian")) return false;
    if (f.hasPromo && !r.hasPromo) return false;
    if (f.openNow && !r.isOpen) return false;
    return true;
  });
}

export function sortRestaurants<T extends RestaurantCardData>(
  rows: T[],
  sort: RestaurantFilters["sort"] = "relevance",
): T[] {
  const out = [...rows];
  switch (sort) {
    case "distance":
      return out.sort((a, b) => a.distanceKm - b.distanceKm);
    case "rating":
      return out.sort((a, b) => b.rating - a.rating);
    case "eta":
      return out.sort((a, b) => a.etaMinutes - b.etaMinutes);
    default:
      return out.sort(
        (a, b) => Number(b.isOpen) - Number(a.isOpen) || relevanceScore(b) - relevanceScore(a),
      );
  }
}
