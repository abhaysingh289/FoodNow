import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Inserts a minimal valid Order for Mei at hk_golden_dragon; returns its id. */
export async function insertOrder(partial: Partial<Prisma.OrderUncheckedCreateInput> = {}): Promise<string> {
  const address = await prisma.address.findUniqueOrThrow({ where: { id: "a_mei_hk" } });
  const order = await prisma.order.create({
    data: {
      userId: "u_mei",
      restaurantId: "hk_golden_dragon",
      country: "HK",
      currency: "HKD",
      addressSnapshot: address as unknown as Prisma.InputJsonValue,
      status: "PLACED",
      subtotalCents: 4200,
      discountCents: 0,
      deliveryFeeCents: 1720,
      taxCents: 0,
      totalCents: 5920,
      distanceKm: 2.4,
      ...partial,
    },
  });
  return order.id;
}
