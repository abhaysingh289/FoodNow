import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ConcurrentModification, InvalidTransition } from "@/lib/errors";
import { transition } from "@/modules/orders/transition";
import { getProvider } from "./registry";
import { startRefund } from "./service";
import type { ProviderEvent } from "./provider";

export type WebhookResult = "PROCESSED" | "DUPLICATE" | "REJECTED" | "UNMATCHED" | "MISMATCH";
export type WebhookOutcome = { httpStatus: 200 | 400; result: WebhookResult };

// WebhookLog has @@unique([provider, eventId]). The first non-rejected delivery stores the raw eventId
// (so "already processed" is a lookup and races hit the constraint); DUPLICATE and REJECTED rows get a
// suffixed id so they can be logged alongside it.

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/** Best-effort extraction of fields from a body that may not be a valid event. */
function peek(rawBody: string): { eventId: string | null; eventType: string; payload: Prisma.InputJsonValue } {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const o = parsed as Record<string, unknown>;
      return {
        eventId: typeof o.eventId === "string" ? o.eventId : null,
        eventType: typeof o.type === "string" ? o.type : "unknown",
        payload: parsed as Prisma.InputJsonValue,
      };
    }
  } catch {
    // fall through
  }
  return { eventId: null, eventType: "unknown", payload: { raw: rawBody.slice(0, 2000) } };
}

/** Best effort: find the order a (possibly untrusted) body refers to. Only used to link the log row. */
async function peekOrderId(payload: Prisma.InputJsonValue): Promise<string | null> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const o = payload as Record<string, unknown>;
  try {
    if (typeof o.providerRef === "string") {
      const p = await prisma.payment.findUnique({ where: { providerRef: o.providerRef } });
      if (p) return p.orderId;
    }
    if (typeof o.refundRef === "string") {
      const r = await prisma.refund.findUnique({ where: { refundRef: o.refundRef }, include: { payment: true } });
      if (r) return r.payment.orderId;
    }
  } catch {
    // linking is best effort
  }
  return null;
}

async function reject(provider: string, rawBody: string, signatureValid: boolean): Promise<WebhookOutcome> {
  const { eventId, eventType, payload } = peek(rawBody);
  const orderId = await peekOrderId(payload);
  await prisma.webhookLog.create({
    data: {
      provider,
      eventId: `${eventId ?? "none"}#rejected-${randomUUID()}`,
      eventType,
      payload,
      signatureValid,
      result: "REJECTED",
      orderId,
    },
  });
  return { httpStatus: 400, result: "REJECTED" };
}

async function duplicate(provider: string, event: ProviderEvent): Promise<WebhookOutcome> {
  const first = await prisma.webhookLog.findUnique({
    where: { provider_eventId: { provider, eventId: event.eventId } },
  });
  await prisma.webhookLog.create({
    data: {
      provider,
      eventId: `${event.eventId}#dup-${randomUUID()}`,
      eventType: event.type,
      payload: event as unknown as Prisma.InputJsonValue,
      signatureValid: true,
      result: "DUPLICATE",
      orderId: first?.orderId ?? null,
    },
  });
  return { httpStatus: 200, result: "DUPLICATE" };
}

/** Provider-agnostic webhook entry point (spec 11.3). Only a reject is a 400; domain outcomes are 200. */
export async function handleWebhook(provider: string, rawBody: string, headers: Headers): Promise<WebhookOutcome> {
  const p = getProvider();
  if (p.name !== provider || !p.verifyWebhook(rawBody, headers)) return reject(provider, rawBody, false);

  let event: ProviderEvent;
  try {
    event = p.parseWebhook(rawBody);
    if (!event || typeof event !== "object") throw new TypeError("not an event");
  } catch {
    return reject(provider, rawBody, true);
  }

  const key = { provider_eventId: { provider, eventId: event.eventId } };
  if (await prisma.webhookLog.findUnique({ where: key })) return duplicate(provider, event);

  try {
    return await processEvent(provider, event);
  } catch (e) {
    // A concurrent delivery of the same event may have won the race.
    const raced = e instanceof ConcurrentModification || e instanceof InvalidTransition || isUniqueViolation(e);
    if (raced && (await prisma.webhookLog.findUnique({ where: key }))) return duplicate(provider, event);
    throw e;
  }
}

type RefundEvent = Extract<ProviderEvent, { refundRef: string }>;
function isRefundEvent(e: ProviderEvent): e is RefundEvent {
  return e.type === "refund.succeeded" || e.type === "refund.failed";
}

async function processEvent(provider: string, event: ProviderEvent): Promise<WebhookOutcome> {
  const base = {
    provider,
    eventId: event.eventId,
    eventType: event.type,
    payload: event as unknown as Prisma.InputJsonValue,
    signatureValid: true,
  };
  const log = async (result: WebhookResult, orderId: string | null = null): Promise<WebhookOutcome> => {
    await prisma.webhookLog.create({ data: { ...base, result, orderId } });
    return { httpStatus: 200, result };
  };

  if (isRefundEvent(event)) {
    const refund = await prisma.refund.findUnique({
      where: { refundRef: event.refundRef },
      include: { payment: true },
    });
    if (!refund) return log("UNMATCHED");
    const orderId = refund.payment.orderId;
    if (event.amountCents !== refund.amountCents) return log("MISMATCH", orderId);
    const refundOk = event.type === "refund.succeeded";
    const refundUpdate = {
      status: refundOk ? "SUCCEEDED" : "FAILED",
      failureReason: refundOk ? null : (event.reason ?? null),
    };
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (refund.status === "PENDING" && order.status === "REFUND_PENDING") {
      await transition(orderId, refundOk ? "REFUND_SUCCEEDED" : "REFUND_FAILED", "PROVIDER", {
        inTx: async (tx) => {
          await tx.webhookLog.create({ data: { ...base, result: "PROCESSED", orderId } });
          const decided = await tx.refund.updateMany({
            where: { id: refund.id, status: "PENDING" },
            data: refundUpdate,
          });
          if (decided.count === 0) throw new ConcurrentModification("Refund already decided");
        },
      });
      return { httpStatus: 200, result: "PROCESSED" };
    }
    // The order has moved on (or the refund is already decided): record only.
    await prisma.$transaction(async (tx) => {
      await tx.webhookLog.create({ data: { ...base, result: "PROCESSED", orderId } });
      await tx.refund.updateMany({ where: { id: refund.id, status: "PENDING" }, data: refundUpdate });
    });
    return { httpStatus: 200, result: "PROCESSED" };
  }

  const payment = await prisma.payment.findUnique({ where: { providerRef: event.providerRef } });
  if (!payment) return log("UNMATCHED");
  const orderId = payment.orderId;
  if (event.amountCents !== payment.amountCents) return log("MISMATCH", orderId);

  const succeeded = event.type === "payment.succeeded";
  const paymentUpdate = {
    status: succeeded ? "SUCCEEDED" : "FAILED",
    failureReason: succeeded ? null : (event.reason ?? null),
  };
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

  if (payment.status === "PENDING" && order.status === "PENDING_PAYMENT") {
    await transition(orderId, succeeded ? "PAYMENT_SUCCEEDED" : "PAYMENT_FAILED", "PROVIDER", {
      inTx: async (tx) => {
        await tx.webhookLog.create({ data: { ...base, result: "PROCESSED", orderId } });
        const decided = await tx.payment.updateMany({
          where: { id: payment.id, status: "PENDING" },
          data: paymentUpdate,
        });
        if (decided.count === 0) throw new ConcurrentModification("Payment already decided");
      },
    });
    return { httpStatus: 200, result: "PROCESSED" };
  }

  // Attempts are final once decided; otherwise the order has moved on. Record the payment, no transition.
  const decidedNow = await prisma.$transaction(async (tx) => {
    await tx.webhookLog.create({ data: { ...base, result: "PROCESSED", orderId } });
    const r = await tx.payment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: paymentUpdate });
    return r.count;
  });
  // Safety net: money arrived for an order that already moved on. Refund that exact payment; the order is untouched.
  if (succeeded && decidedNow === 1) {
    await startRefund(orderId, { reason: "late_payment", transitionOrder: false, paymentId: payment.id });
  }
  return { httpStatus: 200, result: "PROCESSED" };
}
