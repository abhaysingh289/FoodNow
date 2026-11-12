import type { Order } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotFound, ValidationError } from "@/lib/errors";
import { assignRider, computeEta, markDelivery, releaseRider } from "@/modules/delivery";
import { startRefund } from "@/modules/payments/service";
import type { OrderAction } from "./stateMachine";
import { transition } from "./transition";

const REFUNDING: readonly OrderAction[] = ["REJECT", "NO_RIDER", "FAIL_DELIVERY", "RETRY_REFUND"];

/** Ops/auto fulfilment actions. Side effects commit with the status change; refunds start after commit. */
export async function applyOpsAction(
  orderId: string,
  action: OrderAction,
  actor: "OPS" | "AUTO",
  input: { riderId?: string; note?: string } = {},
): Promise<Order> {
  if (action === "ASSIGN_RIDER" && !input.riderId) throw new ValidationError("riderId is required");

  await transition(orderId, action, actor, {
    note: input.note,
    inTx: async (tx, order) => {
      const setEta = async (stage: "ACCEPTED" | "RIDER_ASSIGNED" | "PICKED_UP") => {
        const r = await tx.restaurant.findUniqueOrThrow({ where: { id: order.restaurantId } });
        await tx.order.update({
          where: { id: orderId },
          data: { etaMinutes: computeEta(stage, r.prepMinutes, order.distanceKm) },
        });
      };
      switch (action) {
        case "ACCEPT":
          await setEta("ACCEPTED");
          break;
        case "ASSIGN_RIDER":
          await assignRider(tx, orderId, input.riderId!);
          await setEta("RIDER_ASSIGNED");
          break;
        case "PICK_UP":
          await markDelivery(tx, orderId, "pickedUpAt");
          await setEta("PICKED_UP");
          break;
        case "DELIVER":
          await markDelivery(tx, orderId, "deliveredAt");
          await releaseRider(tx, orderId);
          await tx.order.update({ where: { id: orderId }, data: { etaMinutes: 0 } });
          break;
        case "FAIL_DELIVERY":
          await markDelivery(tx, orderId, "failedAt");
          await releaseRider(tx, orderId);
          break;
        default:
          break;
      }
    },
  });

  if (REFUNDING.includes(action)) await startRefund(orderId);
  return prisma.order.findUniqueOrThrow({ where: { id: orderId } });
}

/** Customer cancel (PLACED only), then refund. */
export async function cancelOrder(orderId: string, userId: string): Promise<Order> {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
  if (!order) throw new NotFound("Order not found");
  await transition(orderId, "CANCEL", "CUSTOMER");
  await startRefund(orderId);
  return prisma.order.findUniqueOrThrow({ where: { id: orderId } });
}
