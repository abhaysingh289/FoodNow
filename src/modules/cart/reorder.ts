import { prisma } from "@/lib/db";
import { NotFound, RestaurantClosed } from "@/lib/errors";

type SnapshotOption = { id?: string; name: string };

/** Replaces the user's cart with a past order's still-orderable lines; returns the names of dropped lines. */
export async function reorder(userId: string, orderId: string): Promise<{ skipped: string[] }> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { restaurant: true, items: { orderBy: { id: "asc" } } },
  });
  if (!order) throw new NotFound("Order not found");
  if (!order.restaurant.isOpen) throw new RestaurantClosed(`${order.restaurant.name} is closed`);

  const kept: { menuItemId: string; qty: number; optionIds: string[]; note: string | null }[] = [];
  const skipped: string[] = [];
  for (const line of order.items) {
    const item = await prisma.menuItem.findUnique({
      where: { id: line.menuItemId },
      include: { groups: { include: { options: true } } },
    });
    const snap = (Array.isArray(line.optionsSnapshot) ? line.optionsSnapshot : []) as SnapshotOption[];
    const available = item?.groups.flatMap((g) => g.options) ?? [];
    const optionIds = snap.map(
      (s) => (s.id ? available.find((o) => o.id === s.id) : available.find((o) => o.name === s.name))?.id,
    );
    if (!item || !item.isAvailable || optionIds.some((id) => !id)) {
      skipped.push(line.nameSnapshot);
      continue;
    }
    kept.push({ menuItemId: item.id, qty: line.qty, optionIds: optionIds as string[], note: line.note });
  }

  await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {} });
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    for (const k of kept) {
      await tx.cartItem.create({
        data: {
          cartId: cart.id,
          menuItemId: k.menuItemId,
          qty: k.qty,
          selectedOptionIds: [...k.optionIds].sort(),
          note: k.note,
        },
      });
    }
    await tx.cart.update({
      where: { id: cart.id },
      data: { restaurantId: kept.length > 0 ? order.restaurantId : null, promoCode: null },
    });
  });
  return { skipped };
}
