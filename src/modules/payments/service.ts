import { prisma } from "@/lib/db";
import { NotFound } from "@/lib/errors";
import { transition } from "@/modules/orders/transition";
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

/**
 * Starts a refund for an order's SUCCEEDED payment (spec 5.5). A no-op while a refund is PENDING or SUCCEEDED.
 * The Refund row is written before the provider call; a provider error is recorded, never rethrown.
 */
export async function startRefund(
  orderId: string,
  opts: { reason?: string; transitionOrder?: boolean } = {},
): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFound("Order not found");
  const payment = await prisma.payment.findFirst({ where: { orderId, status: "SUCCEEDED" } });
  if (!payment) throw new Error(`Order ${orderId} has no succeeded payment to refund`);
  const existing = await prisma.refund.findMany({ where: { paymentId: payment.id } });
  if (existing.some((r) => r.status === "PENDING" || r.status === "SUCCEEDED")) return;

  const idempotencyKey = `refund_${orderId}_${existing.length + 1}`;
  const reason = opts.reason ?? order.failureReason ?? "refund";
  const provider = getProvider();
  const refund = await prisma.refund.create({
    data: {
      paymentId: payment.id,
      provider: provider.name,
      refundRef: null,
      amountCents: payment.amountCents,
      status: "PENDING",
      reason,
      idempotencyKey,
    },
  });
  try {
    const { refundRef } = await provider.refund({
      providerRef: payment.providerRef,
      amountCents: payment.amountCents,
      reason,
      idempotencyKey,
    });
    await prisma.refund.update({ where: { id: refund.id }, data: { refundRef } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.refund.update({ where: { id: refund.id }, data: { status: "FAILED", failureReason: message } });
    if (opts.transitionOrder !== false) await transition(orderId, "REFUND_FAILED", "SYSTEM", { note: message });
  }
}
