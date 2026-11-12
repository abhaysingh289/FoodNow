import { sortRestaurants, type RestaurantCardData } from "./search";

export type HomeGroup = { key: string; title: string; restaurants: RestaurantCardData[] };

export function buildHomeGroups(cards: RestaurantCardData[]): HomeGroup[] {
  const groups: HomeGroup[] = [
    {
      key: "near",
      title: "Near you",
      restaurants: sortRestaurants(
        cards.filter((r) => r.isOpen),
        "distance",
      ).slice(0, 5),
    },
    {
      key: "top",
      title: "Top rated",
      restaurants: sortRestaurants(
        cards.filter((r) => r.rating >= 4.5),
        "rating",
      ),
    },
    {
      key: "fast",
      title: "Fast delivery",
      restaurants: sortRestaurants(
        cards.filter((r) => r.etaMinutes <= 25),
        "eta",
      ),
    },
    {
      key: "deals",
      title: "Deals",
      restaurants: sortRestaurants(
        cards.filter((r) => r.hasPromo),
        "relevance",
      ),
    },
  ];
  const cuisines = [...new Set(cards.flatMap((r) => r.cuisines))].sort();
  for (const c of cuisines) {
    groups.push({
      key: `cuisine:${c}`,
      title: c,
      restaurants: sortRestaurants(
        cards.filter((r) => r.cuisines.includes(c)),
        "relevance",
      ),
    });
  }
  return groups;
}
