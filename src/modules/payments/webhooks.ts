import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ConcurrentModification, InvalidTransition } from "@/lib/errors";
import { transition } from "@/modules/orders/transition";
import { getProvider } from "./registry";
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

async function reject(provider: string, rawBody: string, signatureValid: boolean): Promise<WebhookOutcome> {
  const { eventId, eventType, payload } = peek(rawBody);
  await prisma.webhookLog.create({
    data: {
      provider,
      eventId: `${eventId ?? "none"}#rejected-${randomUUID()}`,
      eventType,
      payload,
      signatureValid,
      result: "REJECTED",
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
    // Updates the Refund row only; the order-level refund transition belongs to the refund flow.
    await prisma.$transaction(async (tx) => {
      await tx.webhookLog.create({ data: { ...base, result: "PROCESSED", orderId } });
      if (refund.status === "PENDING") {
        await tx.refund.update({
          where: { id: refund.id },
          data: {
            status: event.type === "refund.succeeded" ? "SUCCEEDED" : "FAILED",
            failureReason: event.type === "refund.failed" ? (event.reason ?? null) : null,
          },
        });
      }
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
        await tx.payment.update({ where: { id: payment.id }, data: paymentUpdate });
      },
    });
    return { httpStatus: 200, result: "PROCESSED" };
  }

  // Attempts are final once decided; otherwise the order has moved on. Record the payment, no transition.
  await prisma.$transaction(async (tx) => {
    await tx.webhookLog.create({ data: { ...base, result: "PROCESSED", orderId } });
    if (payment.status === "PENDING") await tx.payment.update({ where: { id: payment.id }, data: paymentUpdate });
  });
  return { httpStatus: 200, result: "PROCESSED" };
}
