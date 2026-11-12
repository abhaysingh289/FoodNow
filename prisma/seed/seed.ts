import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";

const dir = path.dirname(fileURLToPath(import.meta.url));
const load = <T>(file: string): T => JSON.parse(readFileSync(path.join(dir, file), "utf8")) as T;

type Option = { id: string; name: string; priceDeltaCents: number };
type Group = { id: string; name: string; required: boolean; minSelect: number; maxSelect: number; options: Option[] };
type Item = { id: string; name: string; description: string; priceCents: number; imageUrl: string; isAvailable: boolean; groups: Group[] };
type Category = { id: string; name: string; sort: number; items: Item[] };
type RestaurantSeed = {
  id: string; country: string; districtId: string; name: string; description: string; cuisines: string[]; tags: string[];
  rating: number; priceLevel: number; prepMinutes: number; lat: number; lng: number; imageUrl: string;
  isOpen: boolean; hasPromo: boolean; categories: Category[];
};
type UserSeed = {
  id: string; name: string; phone: string; defaultCountry: string;
  addresses: { id: string; country: string; districtId: string; label: string; line1: string; lat: number; lng: number }[];
};

/** Deletes every row (children before parents), then inserts the seed JSON. */
export async function resetAndSeed(db: PrismaClient): Promise<void> {
  await db.$transaction([
    db.fakeProviderRefund.deleteMany(),
    db.fakeProviderIntent.deleteMany(),
    db.webhookLog.deleteMany(),
    db.refund.deleteMany(),
    db.payment.deleteMany(),
    db.delivery.deleteMany(),
    db.orderEvent.deleteMany(),
    db.orderItem.deleteMany(),
    db.order.deleteMany(),
    db.cartItem.deleteMany(),
    db.cart.deleteMany(),
    db.address.deleteMany(),
    db.user.deleteMany(),
    db.modifierOption.deleteMany(),
    db.modifierGroup.deleteMany(),
    db.menuItem.deleteMany(),
    db.menuCategory.deleteMany(),
    db.restaurant.deleteMany(),
    db.district.deleteMany(),
    db.promo.deleteMany(),
    db.rider.deleteMany(),
    db.simulationSettings.deleteMany(),
  ]);

  await db.district.createMany({ data: load<Prisma.DistrictCreateManyInput[]>("districts.json") });
  await db.promo.createMany({ data: load<Prisma.PromoCreateManyInput[]>("promos.json") });
  await db.rider.createMany({ data: load<Prisma.RiderCreateManyInput[]>("riders.json") });

  for (const u of load<UserSeed[]>("users.json")) {
    const { addresses, ...user } = u;
    await db.user.create({ data: { ...user, addresses: { create: addresses } } });
  }

  for (const r of load<RestaurantSeed[]>("restaurants.json")) {
    const { categories, ...restaurant } = r;
    await db.restaurant.create({ data: restaurant });
    for (const c of categories) {
      await db.menuCategory.create({ data: { id: c.id, restaurantId: r.id, name: c.name, sort: c.sort } });
      for (const i of c.items) {
        const { groups, ...item } = i;
        await db.menuItem.create({ data: { ...item, categoryId: c.id } });
        for (const g of groups) {
          const { options, ...group } = g;
          await db.modifierGroup.create({ data: { ...group, menuItemId: i.id, options: { create: options } } });
        }
      }
    }
  }

  await db.simulationSettings.create({ data: { id: "singleton", autoMode: false, stepDelaySeconds: 5 } });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.env.DATABASE_URL ??= "file:./dev.db";
  const db = new PrismaClient();
  resetAndSeed(db)
    .then(async () => {
      console.log("Seeded database.");
      await db.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await db.$disconnect();
      process.exit(1);
    });
}
