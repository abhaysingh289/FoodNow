import type { Order, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ConcurrentModification, NotFound } from "@/lib/errors";
import { resolveTransition, type Actor, type OrderAction, type OrderStatus } from "./stateMachine";

export type TransitionOptions = {
  note?: string;
  /** Runs inside the same DB transaction, after the status update and event insert. Receives the updated order. */
  inTx?: (tx: Prisma.TransactionClient, order: Order) => Promise<void>;
};

/** The only writer of Order.status after creation (spec 10.3). */
export async function transition(
  orderId: string,
  action: OrderAction,
  actor: Actor,
  opts: TransitionOptions = {},
): Promise<Order> {
  const current = await prisma.order.findUnique({ where: { id: orderId } });
  if (!current) throw new NotFound("Order not found");
  const from = current.status as OrderStatus;
  const { to, failureReason } = resolveTransition(from, action, actor);

  return prisma.$transaction(async (tx) => {
    const moved = await tx.order.updateMany({
      where: { id: orderId, status: from },
      data: { status: to, ...(failureReason ? { failureReason } : {}) },
    });
    if (moved.count === 0) throw new ConcurrentModification("Order already moved");
    await tx.orderEvent.create({
      data: { orderId, fromStatus: from, toStatus: to, actor, note: opts.note ?? null },
    });
    const updated = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (opts.inTx) await opts.inTx(tx, updated);
    return updated;
  });
}
