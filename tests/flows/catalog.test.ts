import { beforeAll, describe, expect, it } from "vitest";
import { NotFound } from "@/lib/errors";
import { getHomeGroups, getRestaurant, listRestaurants } from "@/modules/catalog";
import { resetDb } from "../helpers/db";

const MEI_HK = { lat: 22.2819, lng: 114.158 };
const ARJUN_SG = { lat: 1.3526, lng: 103.9445 };

describe("catalog", () => {
  beforeAll(async () => {
    await resetDb();
  });

  it("lists only the requested country, open first", async () => {
    const all = await listRestaurants("HK", MEI_HK, {});
    expect(all.every((r) => r.id.startsWith("hk_"))).toBe(true);
    expect(all[all.length - 1].isOpen).toBe(false);
  });

  it("matches item names, filters and sorts", async () => {
    expect((await listRestaurants("HK", MEI_HK, { q: "wonton" })).map((r) => r.id)).toContain(
      "hk_golden_dragon",
    );
    expect(
      (await listRestaurants("SG", ARJUN_SG, { halal: true })).every((r) => r.tags.includes("halal")),
    ).toBe(true);
    const byDist = await listRestaurants("HK", MEI_HK, { sort: "distance" });
    const d = byDist.map((r) => r.distanceKm);
    expect(d).toEqual([...d].sort((a, b) => a - b));
    expect((await listRestaurants("HK", MEI_HK, { minRating: 4 })).every((r) => r.rating >= 4)).toBe(
      true,
    );
  });

  it("computes distance, ETA and fee", async () => {
    const all = await listRestaurants("HK", MEI_HK, {});
    const gd = all.find((r) => r.id === "hk_golden_dragon")!;
    expect(gd.distanceKm).toBe(2.4);
    expect(gd.etaMinutes).toBe(28);
    expect(gd.deliveryFeeCents).toBe(1720);
  });

  it("builds home groups", async () => {
    const groups = await getHomeGroups("HK", MEI_HK);
    expect(groups.slice(0, 4).map((g) => g.key)).toEqual(["near", "top", "fast", "deals"]);
    expect(groups[0].restaurants.length).toBeLessThanOrEqual(5);
    expect(groups[0].restaurants.every((r) => r.isOpen)).toBe(true);
    expect(groups.slice(4).every((g) => g.key === `cuisine:${g.title}`)).toBe(true);
  });

  it("gets a restaurant with menu, and throws NotFound", async () => {
    const r = await getRestaurant("hk_golden_dragon", MEI_HK);
    expect(r.categories.length).toBeGreaterThan(0);
    await expect(getRestaurant("nope", MEI_HK)).rejects.toBeInstanceOf(NotFound);
  });
});
