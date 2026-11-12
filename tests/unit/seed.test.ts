import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "../helpers/db";

describe("seed data", () => {
  beforeAll(async () => {
    await resetDb();
  });

  for (const c of ["HK", "SG"]) {
    it(`${c} satisfies the catalogue invariants`, async () => {
      const rs = await prisma.restaurant.findMany({ where: { country: c } });
      expect(rs.length).toBeGreaterThanOrEqual(7);
      expect(rs.length).toBeLessThanOrEqual(9);
      expect(rs.some((r) => (r.tags as string[]).includes("halal"))).toBe(true);
      expect(rs.some((r) => (r.tags as string[]).includes("vegetarian"))).toBe(true);
      expect(rs.some((r) => !r.isOpen)).toBe(true);
      expect(rs.filter((r) => r.hasPromo).length).toBeGreaterThanOrEqual(2);
      expect(
        await prisma.menuItem.count({ where: { isAvailable: false, category: { restaurant: { country: c } } } }),
      ).toBeGreaterThan(0);
      expect(await prisma.rider.count({ where: { country: c, isAvailable: true } })).toBe(4);
      expect(await prisma.district.count({ where: { country: c } })).toBe(6);
    });
  }

  it("every user has an address in both countries", async () => {
    const users = await prisma.user.findMany({ include: { addresses: true } });
    expect(users.length).toBeGreaterThanOrEqual(3);
    for (const u of users) {
      expect(new Set(u.addresses.map((a) => a.country))).toEqual(new Set(["HK", "SG"]));
    }
  });

  it("every restaurant has 8-12 items, 2-4 categories and >=3 items with modifier groups", async () => {
    const rs = await prisma.restaurant.findMany({
      include: { categories: { include: { items: { include: { groups: true } } } } },
    });
    for (const r of rs) {
      const items = r.categories.flatMap((c) => c.items);
      expect(items.length, r.id).toBeGreaterThanOrEqual(8);
      expect(items.length, r.id).toBeLessThanOrEqual(12);
      expect(r.categories.length, r.id).toBeGreaterThanOrEqual(2);
      expect(r.categories.length, r.id).toBeLessThanOrEqual(4);
      expect(items.filter((i) => i.groups.length > 0).length, r.id).toBeGreaterThanOrEqual(3);
      expect(r.imageUrl.startsWith("/images/")).toBe(true);
    }
  });

  it("has the four promos and the singleton settings", async () => {
    expect(await prisma.promo.count()).toBe(4);
    const s = await prisma.simulationSettings.findUnique({ where: { id: "singleton" } });
    expect(s).toMatchObject({ autoMode: false, stepDelaySeconds: 5 });
  });

  it("has the fixed ids later tasks rely on", async () => {
    const wonton = await prisma.menuItem.findUnique({
      where: { id: "hk_gd_wonton" },
      include: { groups: { include: { options: true } } },
    });
    expect(wonton?.priceCents).toBe(5800);
    const size = wonton!.groups.find((g) => g.name === "Size")!;
    expect(size).toMatchObject({ required: true, minSelect: 1, maxSelect: 1 });
    expect(size.options.find((o) => o.id === "opt_wonton_large")?.priceDeltaCents).toBe(1200);
    const extras = wonton!.groups.find((g) => g.name === "Extras")!;
    expect(extras).toMatchObject({ required: false, minSelect: 0, maxSelect: 3 });
    expect(extras.options.map((o) => o.id).sort()).toEqual(["opt_wonton_chili", "opt_wonton_extra"]);
    expect((await prisma.menuItem.findUnique({ where: { id: "hk_gd_lobster" } }))?.isAvailable).toBe(false);
    expect((await prisma.restaurant.findUnique({ where: { id: "hk_midnight_ramen" } }))?.isOpen).toBe(false);
    const laksa = await prisma.menuItem.findUnique({ where: { id: "sg_tl_laksa" }, include: { groups: { include: { options: true } } } });
    expect(laksa?.priceCents).toBe(850);
    expect(laksa?.groups[0].options.map((o) => o.name)).toEqual(["Mild", "Medium", "Hot"]);
    for (const id of ["u_mei", "u_arjun", "u_sam"]) expect(await prisma.user.findUnique({ where: { id } })).not.toBeNull();
    for (const id of ["a_mei_hk", "a_mei_sg", "a_arjun_sg", "a_arjun_hk"]) expect(await prisma.address.findUnique({ where: { id } })).not.toBeNull();
  });
});
