import type { Prisma, Rider } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotFound, RiderUnavailable } from "@/lib/errors";

export async function assignRider(tx: Prisma.TransactionClient, orderId: string, riderId: string): Promise<Rider> {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFound("Order not found");
  const rider = await tx.rider.findUnique({ where: { id: riderId } });
  if (!rider) throw new RiderUnavailable("Rider is not available");
  if (!rider.isAvailable || rider.country !== order.country) {
    throw new RiderUnavailable(`${rider.name} is not available`);
  }
  // Conditional update guards against two concurrent assignments of the same rider.
  const claimed = await tx.rider.updateMany({ where: { id: riderId, isAvailable: true }, data: { isAvailable: false } });
  if (claimed.count === 0) throw new RiderUnavailable(`${rider.name} is not available`);
  const assignedAt = new Date();
  await tx.delivery.upsert({
    where: { orderId },
    create: { orderId, riderId, assignedAt },
    update: { riderId, assignedAt },
  });
  return { ...rider, isAvailable: false };
}

export async function releaseRider(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  const delivery = await tx.delivery.findUnique({ where: { orderId } });
  if (!delivery?.riderId) return;
  await tx.rider.update({ where: { id: delivery.riderId }, data: { isAvailable: true } });
}

export async function markDelivery(
  tx: Prisma.TransactionClient,
  orderId: string,
  field: "pickedUpAt" | "deliveredAt" | "failedAt",
): Promise<void> {
  await tx.delivery.upsert({
    where: { orderId },
    create: { orderId, [field]: new Date() },
    update: { [field]: new Date() },
  });
}

export async function listRiders(country: string): Promise<(Rider & { currentOrderId: string | null })[]> {
  const riders = await prisma.rider.findMany({
    where: { country },
    orderBy: { id: "asc" },
    include: { deliveries: { where: { deliveredAt: null, failedAt: null }, select: { orderId: true } } },
  });
  return riders.map(({ deliveries, ...rider }) => ({ ...rider, currentOrderId: deliveries[0]?.orderId ?? null }));
}

export async function setRiderAvailability(riderId: string, isAvailable: boolean): Promise<Rider> {
  const rider = await prisma.rider.findUnique({ where: { id: riderId } });
  if (!rider) throw new NotFound("Rider not found");
  if (isAvailable) {
    const active = await prisma.delivery.count({ where: { riderId, deliveredAt: null, failedAt: null } });
    if (active > 0) throw new RiderUnavailable("Rider is on an active delivery");
  }
  return prisma.rider.update({ where: { id: riderId }, data: { isAvailable } });
}

export async function firstAvailableRider(country: string): Promise<Rider | null> {
  return prisma.rider.findFirst({ where: { country, isAvailable: true }, orderBy: { id: "asc" } });
}
