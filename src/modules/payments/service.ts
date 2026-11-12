import { prisma } from "@/lib/db";
import { NotFound } from "@/lib/errors";
import { getProvider } from "./registry";
import type { ClientAction } from "./provider";

/** Starts a new payment attempt for an order. A provider error rethrows and leaves the order untouched. */
export async function startPayment(orderId: string): Promise<ClientAction> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFound("Order not found");
  const attempt = (await prisma.payment.count({ where: { orderId } })) + 1;
  const idempotencyKey = `pay_${orderId}_${attempt}`;
  const provider = getProvider();
  const { providerRef, clientAction } = await provider.createPayment({
    orderId,
    amountCents: order.totalCents,
    currency: order.currency as "HKD" | "SGD",
    idempotencyKey,
  });
  await prisma.payment.create({
    data: {
      orderId,
      provider: provider.name,
      providerRef,
      amountCents: order.totalCents,
      currency: order.currency,
      status: "PENDING",
      idempotencyKey,
    },
  });
  return clientAction;
}
