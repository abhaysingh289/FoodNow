import { prisma } from "@/lib/db";
import type { CountryCode } from "@/lib/countries";
import { NotFound } from "@/lib/errors";
import { deliveryFee } from "@/modules/cart/pricing";
import { etaQuote } from "@/modules/delivery/eta";
import { haversineKm, type LatLng } from "./geo";
import { buildHomeGroups, type HomeGroup } from "./groups";
import {
  filterRestaurants,
  sortRestaurants,
  type RestaurantCardData,
  type RestaurantFilters,
  type SearchableCard,
} from "./search";

type RestaurantRow = {
  id: string;
  country: string;
  name: string;
  cuisines: unknown;
  tags: unknown;
  rating: number;
  priceLevel: number;
  imageUrl: string;
  isOpen: boolean;
  hasPromo: boolean;
  prepMinutes: number;
  lat: number;
  lng: number;
};

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

function toCard(r: RestaurantRow, from: LatLng): RestaurantCardData {
  const distanceKm = haversineKm(from, { lat: r.lat, lng: r.lng });
  return {
    id: r.id,
    name: r.name,
    cuisines: asStrings(r.cuisines),
    tags: asStrings(r.tags),
    rating: r.rating,
    priceLevel: r.priceLevel,
    imageUrl: r.imageUrl,
    isOpen: r.isOpen,
    hasPromo: r.hasPromo,
    distanceKm,
    etaMinutes: etaQuote(r.prepMinutes, distanceKm),
    deliveryFeeCents: deliveryFee(distanceKm, r.country as CountryCode),
  };
}

async function loadCards(country: CountryCode, from: LatLng): Promise<SearchableCard[]> {
  const rows = await prisma.restaurant.findMany({
    where: { country },
    include: { categories: { include: { items: { select: { name: true } } } } },
  });
  return rows.map((r) => ({
    ...toCard(r, from),
    itemNames: r.categories.flatMap((c) => c.items.map((i) => i.name)),
  }));
}

function stripSearchFields({ itemNames: _itemNames, ...card }: SearchableCard): RestaurantCardData {
  return card;
}

export async function listRestaurants(
  country: CountryCode,
  from: LatLng,
  filters: RestaurantFilters,
): Promise<RestaurantCardData[]> {
  const cards = filterRestaurants(await loadCards(country, from), filters);
  return sortRestaurants(cards, filters.sort).map(stripSearchFields);
}

export async function getHomeGroups(country: CountryCode, from: LatLng): Promise<HomeGroup[]> {
  return buildHomeGroups((await loadCards(country, from)).map(stripSearchFields));
}

function loadMenu(restaurantId: string) {
  return prisma.menuCategory.findMany({
    where: { restaurantId },
    orderBy: { sort: "asc" },
    include: { items: { include: { groups: { include: { options: true } } } } },
  });
}

export type MenuItemWithModifiers = Awaited<ReturnType<typeof loadMenu>>[number]["items"][number];

export async function getRestaurant(id: string, from: LatLng) {
  const r = await prisma.restaurant.findUnique({ where: { id } });
  if (!r) throw new NotFound(`Restaurant ${id} not found`);
  const categories = await loadMenu(id);
  return {
    ...toCard(r, from),
    description: r.description,
    categories: categories.map((c) => ({ id: c.id, name: c.name, items: c.items })),
  };
}
