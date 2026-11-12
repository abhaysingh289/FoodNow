import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { NotFound, ValidationError } from "@/lib/errors";
import type { PaymentProvider, ProviderEvent, WebhookTransport } from "../provider";
import { FAKE_SIGNATURE_HEADER, signFake, verifyFake } from "./signing";

export type DecisionMode = "normal" | "twice" | "bad_signature";
export type FakeItem = {
  kind: "intent" | "refund";
  ref: string;
  amountCents: number;
  currency: string;
  status: string;
  updatedAt: Date;
  hasEvent: boolean;
};

export interface FakeControls {
  decideIntent(ref: string, outcome: "succeed" | "fail", mode?: DecisionMode): Promise<void>;
  decideRefund(ref: string, outcome: "succeed" | "fail", mode?: DecisionMode): Promise<void>;
  leavePending(ref: string): Promise<void>;
  resend(kind: "intent" | "refund", ref: string): Promise<void>;
  listItems(): Promise<FakeItem[]>;
}

const UNDECIDED = ["REQUIRES_ACTION", "PENDING"];
const DAY_MS = 24 * 60 * 60 * 1000;

export function createFakeProvider(opts: {
  secret: string;
  transport: WebhookTransport;
}): PaymentProvider & FakeControls {
  const { secret, transport } = opts;

  const newId = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "")}`;

  async function deliver(rawBody: string, mode: DecisionMode): Promise<void> {
    const signature = signFake(mode === "bad_signature" ? rawBody + "!" : rawBody, secret);
    const headers = { "content-type": "application/json", [FAKE_SIGNATURE_HEADER]: signature };
    await transport(rawBody, headers);
    if (mode === "twice") await transport(rawBody, { ...headers });
  }

  return {
    name: "fake",

    async createPayment({ amountCents, currency, idempotencyKey }) {
      const existing = await prisma.fakeProviderIntent.findUnique({ where: { idempotencyKey } });
      const intent =
        existing ??
        (await prisma.fakeProviderIntent.create({
          data: { ref: newId("fpi"), amountCents, currency, status: "REQUIRES_ACTION", idempotencyKey },
        }));
      return {
        providerRef: intent.ref,
        clientAction: { type: "fake_sheet", providerRef: intent.ref },
      };
    },

    async refund({ providerRef, amountCents, idempotencyKey }) {
      const existing = await prisma.fakeProviderRefund.findUnique({ where: { idempotencyKey } });
      if (existing) return { refundRef: existing.ref };
      const intent = await prisma.fakeProviderIntent.findUnique({ where: { ref: providerRef } });
      if (!intent) throw new ValidationError(`Unknown payment ${providerRef}`);
      if (intent.status !== "SUCCEEDED") {
        throw new ValidationError(`Payment ${providerRef} is ${intent.status}; only succeeded payments can be refunded`);
      }
      const created = await prisma.fakeProviderRefund.create({
        data: { ref: newId("fpr"), intentRef: providerRef, amountCents, status: "PENDING", idempotencyKey },
      });
      return { refundRef: created.ref };
    },

    verifyWebhook(rawBody, headers) {
      return verifyFake(rawBody, headers.get(FAKE_SIGNATURE_HEADER), secret);
    },

    parseWebhook(rawBody) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        throw new ValidationError("Webhook body is not valid JSON");
      }
      const e = parsed as Partial<ProviderEvent> & { providerRef?: string; refundRef?: string };
      const okType =
        e.type === "payment.succeeded" ||
        e.type === "payment.failed" ||
        e.type === "refund.succeeded" ||
        e.type === "refund.failed";
      const isPayment = e.type?.startsWith("payment.");
      const ref = isPayment ? e.providerRef : e.refundRef;
      if (!okType || typeof e.eventId !== "string" || typeof ref !== "string" || typeof e.amountCents !== "number") {
        throw new ValidationError("Malformed webhook event");
      }
      return e as ProviderEvent;
    },

    async decideIntent(ref, outcome, mode = "normal") {
      const intent = await prisma.fakeProviderIntent.findUnique({ where: { ref } });
      if (!intent) throw new NotFound(`Unknown payment ${ref}`);
      if (!UNDECIDED.includes(intent.status)) throw new ValidationError("Already decided");
      const succeeded = outcome === "succeed";
      const event: ProviderEvent = {
        eventId: newId("evt"),
        type: succeeded ? "payment.succeeded" : "payment.failed",
        providerRef: ref,
        amountCents: intent.amountCents,
        ...(succeeded ? {} : { reason: "card_declined" }),
      };
      const claimed = await prisma.fakeProviderIntent.updateMany({
        where: { ref, status: { in: UNDECIDED } },
        data: { status: succeeded ? "SUCCEEDED" : "FAILED", lastEvent: event },
      });
      if (claimed.count === 0) throw new ValidationError("Already decided");
      await deliver(JSON.stringify(event), mode);
    },

    async decideRefund(ref, outcome, mode = "normal") {
      const refund = await prisma.fakeProviderRefund.findUnique({ where: { ref } });
      if (!refund) throw new NotFound(`Unknown refund ${ref}`);
      if (refund.status !== "PENDING") throw new ValidationError("Already decided");
      const succeeded = outcome === "succeed";
      const event: ProviderEvent = {
        eventId: newId("evt"),
        type: succeeded ? "refund.succeeded" : "refund.failed",
        refundRef: ref,
        amountCents: refund.amountCents,
        ...(succeeded ? {} : { reason: "insufficient_merchant_balance" }),
      };
      const claimed = await prisma.fakeProviderRefund.updateMany({
        where: { ref, status: "PENDING" },
        data: { status: succeeded ? "SUCCEEDED" : "FAILED", lastEvent: event },
      });
      if (claimed.count === 0) throw new ValidationError("Already decided");
      await deliver(JSON.stringify(event), mode);
    },

    async leavePending(ref) {
      const intent = await prisma.fakeProviderIntent.findUnique({ where: { ref } });
      if (!intent) throw new NotFound(`Unknown payment ${ref}`);
      if (intent.status !== "REQUIRES_ACTION" && intent.status !== "PENDING") {
        throw new ValidationError("Already decided");
      }
      await prisma.fakeProviderIntent.update({ where: { ref }, data: { status: "PENDING" } });
    },

    async resend(kind, ref) {
      const row =
        kind === "intent"
          ? await prisma.fakeProviderIntent.findUnique({ where: { ref } })
          : await prisma.fakeProviderRefund.findUnique({ where: { ref } });
      if (!row) throw new NotFound(`Unknown ${kind} ${ref}`);
      if (row.lastEvent == null) throw new ValidationError("Nothing to resend: no event has been emitted yet");
      await deliver(JSON.stringify(row.lastEvent), "normal");
    },

    async listItems() {
      const since = new Date(Date.now() - DAY_MS);
      const [intents, refunds] = await Promise.all([
        prisma.fakeProviderIntent.findMany(),
        prisma.fakeProviderRefund.findMany(),
      ]);
      const items: FakeItem[] = [
        ...intents.map((i) => ({
          kind: "intent" as const,
          ref: i.ref,
          amountCents: i.amountCents,
          currency: i.currency,
          status: i.status,
          updatedAt: i.updatedAt,
          hasEvent: i.lastEvent != null,
        })),
        ...refunds.map((r) => ({
          kind: "refund" as const,
          ref: r.ref,
          amountCents: r.amountCents,
          currency: intents.find((i) => i.ref === r.intentRef)?.currency ?? "",
          status: r.status,
          updatedAt: r.updatedAt,
          hasEvent: r.lastEvent != null,
        })),
      ];
      const undecided = items
        .filter((i) => UNDECIDED.includes(i.status))
        .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
      const decided = items
        .filter((i) => !UNDECIDED.includes(i.status) && i.updatedAt >= since)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return [...undecided, ...decided];
    },
  };
}
