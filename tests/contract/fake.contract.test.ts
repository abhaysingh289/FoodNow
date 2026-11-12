import { beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { createFakeProvider } from "@/modules/payments/fake/fakeProvider";
import { FAKE_SIGNATURE_HEADER, signFake } from "@/modules/payments/fake/signing";
import { resetDb } from "../helpers/db";
import { runPaymentProviderContract } from "./paymentProvider.contract";

const SECRET = "contract-secret";

function makeFake() {
  const captured: { rawBody: string; headers: Record<string, string> }[] = [];
  const fake = createFakeProvider({
    secret: SECRET,
    transport: async (rawBody, headers) => {
      captured.push({ rawBody, headers });
    },
  });
  return { fake, captured };
}

beforeEach(async () => {
  await resetDb();
});

runPaymentProviderContract("fake", () => {
  const { fake, captured } = makeFake();
  return {
    provider: fake,
    captured,
    succeed: (ref) => fake.decideIntent(ref, "succeed"),
    succeedRefund: (ref) => fake.decideRefund(ref, "succeed"),
  };
});

describe("fake specifics", () => {
  const pay = (f: ReturnType<typeof makeFake>["fake"], key = "k1") =>
    f.createPayment({ orderId: "o1", amountCents: 500, currency: "SGD", idempotencyKey: key });

  it("createPayment returns a fake_sheet action", async () => {
    const { fake } = makeFake();
    const r = await pay(fake);
    expect(r.clientAction).toEqual({ type: "fake_sheet", providerRef: r.providerRef });
    expect(r.providerRef).toMatch(/^fpi_/);
  });

  it("fail emits payment.failed with card_declined", async () => {
    const { fake, captured } = makeFake();
    const r = await pay(fake);
    await fake.decideIntent(r.providerRef, "fail");
    expect(fake.parseWebhook(captured.at(-1)!.rawBody)).toMatchObject({
      type: "payment.failed",
      reason: "card_declined",
      providerRef: r.providerRef,
    });
    expect(captured.at(-1)!.headers["content-type"]).toBe("application/json");
  });

  it("twice sends identical eventId, body and headers", async () => {
    const { fake, captured } = makeFake();
    const r = await pay(fake);
    await fake.decideIntent(r.providerRef, "succeed", "twice");
    expect(captured).toHaveLength(2);
    expect(captured[1]).toEqual(captured[0]);
    expect(JSON.parse(captured[0].rawBody).eventId).toMatch(/^evt_/);
  });

  it("bad_signature fails verification", async () => {
    const { fake, captured } = makeFake();
    const r = await pay(fake);
    await fake.decideIntent(r.providerRef, "succeed", "bad_signature");
    const { rawBody, headers } = captured[0];
    expect(fake.verifyWebhook(rawBody, new Headers(headers))).toBe(false);
    expect(headers[FAKE_SIGNATURE_HEADER]).not.toBe(signFake(rawBody, SECRET));
  });

  it("verifyWebhook rejects a missing or short signature", async () => {
    const { fake } = makeFake();
    expect(fake.verifyWebhook("{}", new Headers())).toBe(false);
    expect(fake.verifyWebhook("{}", new Headers({ [FAKE_SIGNATURE_HEADER]: "abc" }))).toBe(false);
  });

  it("second decision is rejected", async () => {
    const { fake } = makeFake();
    const r = await pay(fake);
    await fake.decideIntent(r.providerRef, "succeed");
    await expect(fake.decideIntent(r.providerRef, "fail")).rejects.toThrow(ValidationError);
    await expect(fake.decideIntent(r.providerRef, "fail")).rejects.toThrow("Already decided");
  });

  it("leavePending allows a later decision without emitting an event", async () => {
    const { fake, captured } = makeFake();
    const r = await pay(fake);
    await fake.leavePending(r.providerRef);
    expect(captured).toHaveLength(0);
    await fake.decideIntent(r.providerRef, "succeed");
    expect(captured).toHaveLength(1);
  });

  it("resend replays the stored event byte-for-byte", async () => {
    const { fake, captured } = makeFake();
    const r = await pay(fake);
    await fake.decideIntent(r.providerRef, "succeed");
    await fake.resend("intent", r.providerRef);
    expect(captured).toHaveLength(2);
    expect(captured[1].rawBody).toBe(captured[0].rawBody);
    expect(fake.verifyWebhook(captured[1].rawBody, new Headers(captured[1].headers))).toBe(true);
  });

  it("refund guards and failure reason", async () => {
    const { fake, captured } = makeFake();
    await expect(
      fake.refund({ providerRef: "fpi_nope", amountCents: 1, reason: "x", idempotencyKey: "r0" }),
    ).rejects.toThrow(ValidationError);
    const r = await pay(fake);
    await expect(
      fake.refund({ providerRef: r.providerRef, amountCents: 1, reason: "x", idempotencyKey: "r1" }),
    ).rejects.toThrow(ValidationError);
    await fake.decideIntent(r.providerRef, "succeed");
    const rf = await fake.refund({ providerRef: r.providerRef, amountCents: 300, reason: "x", idempotencyKey: "r2" });
    expect(rf.refundRef).toMatch(/^fpr_/);
    await fake.decideRefund(rf.refundRef, "fail");
    expect(fake.parseWebhook(captured.at(-1)!.rawBody)).toMatchObject({
      type: "refund.failed",
      reason: "insufficient_merchant_balance",
      amountCents: 300,
    });
    await expect(fake.decideRefund(rf.refundRef, "succeed")).rejects.toThrow("Already decided");
  });

  it("listItems puts undecided first and flags events", async () => {
    const { fake } = makeFake();
    const a = await pay(fake, "ka");
    const b = await pay(fake, "kb");
    await fake.decideIntent(a.providerRef, "succeed");
    const items = await fake.listItems();
    expect(items.map((i) => i.ref)).toEqual([b.providerRef, a.providerRef]);
    expect(items[0]).toMatchObject({ kind: "intent", status: "REQUIRES_ACTION", hasEvent: false, currency: "SGD" });
    expect(items[1]).toMatchObject({ status: "SUCCEEDED", hasEvent: true });
  });
});
