import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  CartConflict, ConcurrentModification, CountryMismatch, InvalidTransition, ItemUnavailable,
  NotFound, PromoInvalid, RestaurantClosed,
} from "@/lib/errors";
import { addItem, getCart, setPromo } from "@/modules/cart";
import {
  abandonOrder, getOrderDetail, listOrdersForUser, placeOrder, retryPayment, transition,
} from "@/modules/orders";
import { handleWebhook } from "@/modules/payments";
import { getProvider } from "@/modules/payments/registry";
import { getFakeControls, setWebhookTransport } from "@/modules/payments/registry";
import { FAKE_SIGNATURE_HEADER, signFake } from "@/modules/payments/fake/signing";
import { insertOrder } from "../helpers/fixtures";

let MEI_HK_ADDR: Awaited<ReturnType<typeof prisma.address.findUniqueOrThrow>>;

beforeAll(() => {
  setWebhookTransport((body, h) => handleWebhook("fake", body, new Headers(h)).then(() => {}));
});

beforeEach(async () => {
  const { resetDb } = await import("../helpers/db");
  await resetDb();
  MEI_HK_ADDR = await prisma.address.findUniqueOrThrow({ where: { id: "a_mei_hk" } });
});

async function ref(orderId: string): Promise<string> {
  const p = await prisma.payment.findFirstOrThrow({ where: { orderId }, orderBy: { createdAt: "desc" } });
  return p.providerRef;
}

async function fillCartMei() {
  await addItem("u_mei", { menuItemId: "hk_gd_har_gow", qty: 2, optionIds: [] });
}

async function newOrder(): Promise<string> {
  await fillCartMei();
  return (await placeOrder("u_mei", "a_mei_hk")).orderId;
}

function signedHeaders(body: string) {
  return new Headers({ [FAKE_SIGNATURE_HEADER]: signFake(body, "test-secret") });
}

describe("checkout", () => {
  it("places an order, snapshots it, clears the cart and rejects a second submit", async () => {
    await fillCartMei();
    const { orderId, clientAction } = await placeOrder("u_mei", "a_mei_hk");
    expect(clientAction.type).toBe("fake_sheet");
    const d = await getOrderDetail(orderId);
    expect(d).toMatchObject({ status: "PENDING_PAYMENT", totalCents: 10120, currency: "HKD", country: "HK" });
    expect(d.items).toHaveLength(1);
    expect(d.items[0]).toMatchObject({ nameSnapshot: "Har Gow (4 pcs)", unitPriceCents: 4200, qty: 2 });
    expect(d.delivery).not.toBeNull();
    expect(d.payments).toHaveLength(1);
    expect(d.payments[0]).toMatchObject({ status: "PENDING", amountCents: 10120, idempotencyKey: `pay_${orderId}_1` });
    expect(d.events.map((e) => [e.fromStatus, e.toStatus, e.actor])).toEqual([[null, "PENDING_PAYMENT", "CUSTOMER"]]);
    expect((await getCart("u_mei", MEI_HK_ADDR)).lines).toHaveLength(0);
    await expect(placeOrder("u_mei", "a_mei_hk")).rejects.toBeInstanceOf(CartConflict);
    await expect(placeOrder("u_mei", "a_mei_hk")).rejects.toThrow("Your cart is empty");
    expect(await prisma.order.count()).toBe(1);
  });

  it("refuses concurrent double submits with a single order", async () => {
    await fillCartMei();
    const results = await Promise.allSettled([placeOrder("u_mei", "a_mei_hk"), placeOrder("u_mei", "a_mei_hk")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(lost.reason).toBeInstanceOf(CartConflict);
    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.payment.count()).toBe(1);
  });

  it("refuses country mismatch, closed restaurant, unavailable items and invalid promos", async () => {
    await fillCartMei();
    await expect(placeOrder("u_mei", "a_mei_sg")).rejects.toBeInstanceOf(CountryMismatch);
    await expect(placeOrder("u_arjun", "a_arjun_sg")).rejects.toBeInstanceOf(CartConflict);
    await expect(placeOrder("u_mei", "a_arjun_sg")).rejects.toBeInstanceOf(NotFound);

    await prisma.menuItem.update({ where: { id: "hk_gd_har_gow" }, data: { isAvailable: false } });
    await expect(placeOrder("u_mei", "a_mei_hk")).rejects.toThrow(
      new ItemUnavailable("Har Gow (4 pcs) is no longer available"),
    );
    await prisma.menuItem.update({ where: { id: "hk_gd_har_gow" }, data: { isAvailable: true } });

    await prisma.restaurant.update({ where: { id: "hk_golden_dragon" }, data: { isOpen: false } });
    await expect(placeOrder("u_mei", "a_mei_hk")).rejects.toBeInstanceOf(RestaurantClosed);
    await prisma.restaurant.update({ where: { id: "hk_golden_dragon" }, data: { isOpen: true } });

    await prisma.cart.update({ where: { userId: "u_mei" }, data: { promoCode: "NOPE" } });
    await expect(placeOrder("u_mei", "a_mei_hk")).rejects.toBeInstanceOf(PromoInvalid);
    expect(await prisma.order.count()).toBe(0);
  });

  it("re-prices server-side and stores the promo code and distance", async () => {
    await fillCartMei();
    await setPromo("u_mei", "FREEDEL", "HK");
    const view = await getCart("u_mei", MEI_HK_ADDR);
    expect(view.price.deliveryFeeCents).toBe(0);
    const { orderId } = await placeOrder("u_mei", "a_mei_hk");
    const d = await getOrderDetail(orderId);
    expect(d).toMatchObject({ promoCode: "FREEDEL", deliveryFeeCents: 0, totalCents: 8400 });
    expect(d.distanceKm).toBe(view.price.distanceKm);
    expect(d.addressSnapshot).toMatchObject({ id: "a_mei_hk" });
  });
});

describe("payment start failures", () => {
  it("lets retryPayment resume after createPayment fails at checkout", async () => {
    await fillCartMei();
    const spy = vi.spyOn(getProvider(), "createPayment").mockRejectedValueOnce(new Error("provider down"));
    await expect(placeOrder("u_mei", "a_mei_hk")).rejects.toThrow("provider down");
    const order = await prisma.order.findFirstOrThrow();
    expect(order.status).toBe("PENDING_PAYMENT");
    expect(await prisma.payment.count()).toBe(0);
    await expect(retryPayment(order.id, "u_sam")).rejects.toBeInstanceOf(NotFound);
    expect((await retryPayment(order.id, "u_mei")).type).toBe("fake_sheet");
    const d = await getOrderDetail(order.id);
    expect(d.status).toBe("PENDING_PAYMENT");
    expect(d.payments).toHaveLength(1);
    expect(d.payments[0].idempotencyKey).toBe(`pay_${order.id}_1`);
    expect(d.events).toHaveLength(1);
    spy.mockRestore();
  });

  it("lets retryPayment resume after createPayment fails on a decline-then-retry", async () => {
    const orderId = await newOrder();
    await getFakeControls().decideIntent(await ref(orderId), "fail");
    const spy = vi.spyOn(getProvider(), "createPayment").mockRejectedValueOnce(new Error("provider down"));
    await expect(retryPayment(orderId, "u_mei")).rejects.toThrow("provider down");
    let d = await getOrderDetail(orderId);
    expect(d.status).toBe("PENDING_PAYMENT");
    expect(d.payments).toHaveLength(1);
    await retryPayment(orderId, "u_mei");
    d = await getOrderDetail(orderId);
    expect(d.status).toBe("PENDING_PAYMENT");
    expect(d.payments).toHaveLength(2);
    expect(d.payments[1].status).toBe("PENDING");
    await getFakeControls().decideIntent(await ref(orderId), "succeed");
    expect((await getOrderDetail(orderId)).status).toBe("PLACED");
    spy.mockRestore();
  });
});

describe("payment webhooks", () => {
  it("moves PENDING_PAYMENT to PLACED on success", async () => {
    const orderId = await newOrder();
    await getFakeControls().decideIntent(await ref(orderId), "succeed");
    const d = await getOrderDetail(orderId);
    expect(d.status).toBe("PLACED");
    expect(d.payments[0].status).toBe("SUCCEEDED");
    expect(d.events.map((e) => [e.toStatus, e.actor])).toEqual([
      ["PENDING_PAYMENT", "CUSTOMER"],
      ["PLACED", "PROVIDER"],
    ]);
    expect(d.webhookLogs.map((l) => l.result)).toEqual(["PROCESSED"]);
  });

  it("supports decline, retry then success", async () => {
    const o2 = await newOrder();
    await getFakeControls().decideIntent(await ref(o2), "fail");
    const failed = await getOrderDetail(o2);
    expect(failed.status).toBe("PAYMENT_FAILED");
    expect(failed.payments[0]).toMatchObject({ status: "FAILED", failureReason: "card_declined" });
    await expect(retryPayment(o2, "u_sam")).rejects.toBeInstanceOf(NotFound);
    const action = await retryPayment(o2, "u_mei");
    expect(action.type).toBe("fake_sheet");
    const retried = await getOrderDetail(o2);
    expect(retried.status).toBe("PENDING_PAYMENT");
    expect(retried.payments).toHaveLength(2);
    expect(retried.payments[1].idempotencyKey).toBe(`pay_${o2}_2`);
    await getFakeControls().decideIntent(await ref(o2), "succeed");
    expect((await getOrderDetail(o2)).status).toBe("PLACED");
  });

  it("supports decline then abandon", async () => {
    const o3 = await newOrder();
    await getFakeControls().decideIntent(await ref(o3), "fail");
    await expect(abandonOrder(o3, "u_sam")).rejects.toBeInstanceOf(NotFound);
    expect(await abandonOrder(o3, "u_mei")).toMatchObject({ status: "CANCELLED", failureReason: "PAYMENT_ABANDONED" });
  });

  it("logs a duplicate delivery once and changes nothing", async () => {
    const o4 = await newOrder();
    await getFakeControls().decideIntent(await ref(o4), "succeed", "twice");
    expect(await prisma.webhookLog.findMany({ where: { result: "DUPLICATE" } })).toHaveLength(1);
    const d = await getOrderDetail(o4);
    expect(d.status).toBe("PLACED");
    expect(d.events).toHaveLength(2);
    expect(d.webhookLogs.map((l) => l.result).sort()).toEqual(["DUPLICATE", "PROCESSED"]);
  });

  it("rejects a bad signature, then processes the valid resend of the same event", async () => {
    const o5 = await newOrder();
    await getFakeControls().decideIntent(await ref(o5), "succeed", "bad_signature");
    expect((await getOrderDetail(o5)).status).toBe("PENDING_PAYMENT");
    expect(await prisma.webhookLog.count({ where: { result: "REJECTED" } })).toBe(1);
    await getFakeControls().resend("intent", await ref(o5));
    expect((await getOrderDetail(o5)).status).toBe("PLACED");
    expect(await prisma.webhookLog.count({ where: { result: "PROCESSED" } })).toBe(1);
  });

  it("links a bad-signature delivery to its order without changing state", async () => {
    const o = await newOrder();
    const body = JSON.stringify({ eventId: "evt_bad", type: "payment.succeeded", providerRef: await ref(o), amountCents: 10120 });
    expect(await handleWebhook("fake", body, new Headers({ [FAKE_SIGNATURE_HEADER]: "nope" }))).toEqual({
      httpStatus: 400,
      result: "REJECTED",
    });
    const d = await getOrderDetail(o);
    expect(d.status).toBe("PENDING_PAYMENT");
    expect(d.payments[0].status).toBe("PENDING");
    expect(d.events).toHaveLength(1);
    expect(d.webhookLogs).toHaveLength(1);
    expect(d.webhookLogs[0]).toMatchObject({ result: "REJECTED", signatureValid: false, orderId: o });
    // an unknown ref stays unlinked
    const other = JSON.stringify({ eventId: "evt_z", type: "payment.succeeded", providerRef: "nope", amountCents: 1 });
    await handleWebhook("fake", other, new Headers());
    expect(await prisma.webhookLog.count({ where: { result: "REJECTED", orderId: null } })).toBe(1);
  });

  it("rejects unparseable bodies with 400, never throwing", async () => {
    for (const body of ["not json", "null", "42", "{}", JSON.stringify({ eventId: "e" })]) {
      expect(await handleWebhook("fake", body, signedHeaders(body))).toEqual({ httpStatus: 400, result: "REJECTED" });
    }
    expect(await handleWebhook("fake", "{}", new Headers())).toEqual({ httpStatus: 400, result: "REJECTED" });
    expect(await prisma.webhookLog.count({ where: { result: "REJECTED" } })).toBe(6);
  });

  it("logs unknown references as UNMATCHED", async () => {
    const body = JSON.stringify({ eventId: "evt_u", type: "payment.succeeded", providerRef: "nope", amountCents: 1 });
    expect(await handleWebhook("fake", body, signedHeaders(body))).toEqual({ httpStatus: 200, result: "UNMATCHED" });
    const log = await prisma.webhookLog.findFirstOrThrow({ where: { eventId: "evt_u" } });
    expect(log).toMatchObject({ result: "UNMATCHED", orderId: null, signatureValid: true });
  });

  it("logs an amount mismatch, leaves the order alone and flags it", async () => {
    const o6 = await newOrder();
    const body = JSON.stringify({ eventId: "evt_x", type: "payment.succeeded", providerRef: await ref(o6), amountCents: 1 });
    expect(await handleWebhook("fake", body, signedHeaders(body))).toEqual({ httpStatus: 200, result: "MISMATCH" });
    const d = await getOrderDetail(o6);
    expect(d.status).toBe("PENDING_PAYMENT");
    expect(d.payments[0].status).toBe("PENDING");
    expect(d.flags).toContain("AMOUNT_MISMATCH");
  });

  it("records late payments without transitioning the order", async () => {
    const o7 = await newOrder();
    await getFakeControls().leavePending(await ref(o7));
    await prisma.order.update({ where: { id: o7 }, data: { status: "CANCELLED" } });
    await getFakeControls().decideIntent(await ref(o7), "succeed");
    const d = await getOrderDetail(o7);
    expect(d.status).toBe("CANCELLED");
    expect(d.payments[0].status).toBe("SUCCEEDED");
    expect(d.webhookLogs.map((l) => l.result)).toEqual(["PROCESSED"]);
    expect(d.events).toHaveLength(1);

    const o8 = await newOrder();
    await prisma.order.update({ where: { id: o8 }, data: { status: "CANCELLED" } });
    await getFakeControls().decideIntent(await ref(o8), "fail");
    const d8 = await getOrderDetail(o8);
    expect(d8.status).toBe("CANCELLED");
    expect(d8.payments[0].status).toBe("FAILED");
  });
});

describe("transition", () => {
  it("rejects invalid transitions", async () => {
    const orderId = await newOrder();
    await getFakeControls().decideIntent(await ref(orderId), "succeed");
    await expect(transition(orderId, "PAYMENT_SUCCEEDED", "PROVIDER")).rejects.toBeInstanceOf(InvalidTransition);
    await expect(transition("missing", "ACCEPT", "OPS")).rejects.toBeInstanceOf(NotFound);
  });

  it("lets exactly one of two racing transitions win", async () => {
    const orderId = await insertOrder({ status: "PLACED" });
    const results = await Promise.allSettled([
      transition(orderId, "ACCEPT", "OPS"),
      transition(orderId, "CANCEL", "CUSTOMER"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConcurrentModification);
    expect(await prisma.orderEvent.count({ where: { orderId } })).toBe(1);
  });

  it("writes failureReason, event note and runs inTx atomically", async () => {
    const orderId = await insertOrder({ status: "PLACED" });
    const o = await transition(orderId, "CANCEL", "CUSTOMER", {
      note: "changed my mind",
      inTx: async (tx, order) => {
        await tx.orderEvent.create({ data: { orderId: order.id, toStatus: order.status, actor: "SYSTEM", note: "side" } });
      },
    });
    expect(o).toMatchObject({ status: "REFUND_PENDING", failureReason: "CUSTOMER_CANCELLED" });
    const events = await prisma.orderEvent.findMany({ where: { orderId } });
    expect(events.map((e) => e.note).sort()).toEqual(["changed my mind", "side"]);

    const o2 = await insertOrder({ status: "PLACED" });
    await expect(
      transition(o2, "ACCEPT", "OPS", { inTx: async () => { throw new Error("boom"); } }),
    ).rejects.toThrow("boom");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o2 } })).status).toBe("PLACED");
    expect(await prisma.orderEvent.count({ where: { orderId: o2 } })).toBe(0);
  });
});

describe("order queries", () => {
  it("lists active and history tabs newest first", async () => {
    const a = await insertOrder({ status: "PLACED", createdAt: new Date("2026-01-01") });
    const b = await insertOrder({ status: "REFUND_FAILED", createdAt: new Date("2026-01-02") });
    const c = await insertOrder({ status: "DELIVERED" });
    const d = await insertOrder({ status: "REFUNDED" });
    const e = await insertOrder({ status: "CANCELLED", failureReason: "PAYMENT_ABANDONED" });
    const active = await listOrdersForUser("u_mei", "active");
    expect(active.map((o) => o.id)).toEqual([b, a]);
    expect(active[0]).toMatchObject({
      restaurantName: "Golden Dragon Dim Sum", totalCents: 5920, country: "HK", status: "REFUND_FAILED",
    });
    const history = await listOrdersForUser("u_mei", "history");
    expect(history.map((o) => o.id).sort()).toEqual([c, d, e].sort());
    expect(history.find((o) => o.id === e)!.failureReason).toBe("PAYMENT_ABANDONED");
    expect(await listOrdersForUser("u_sam", "active")).toEqual([]);
  });

  it("throws NotFound for an unknown order", async () => {
    await expect(getOrderDetail("missing")).rejects.toBeInstanceOf(NotFound);
  });
});
