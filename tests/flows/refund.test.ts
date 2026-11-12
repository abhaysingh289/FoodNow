import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { NotFound } from "@/lib/errors";
import { addItem } from "@/modules/cart";
import { listRiders } from "@/modules/delivery";
import { getOrderDetail, placeOrder, type OrderAction } from "@/modules/orders";
import { applyOpsAction, cancelOrder } from "@/modules/orders/actions";
import { handleWebhook } from "@/modules/payments";
import { getFakeControls, getProvider, setWebhookTransport } from "@/modules/payments/registry";
import { startPayment, startRefund } from "@/modules/payments/service";
import { paidOrder } from "../helpers/orders";

beforeAll(() => {
  setWebhookTransport((body, h) => handleWebhook("fake", body, new Headers(h)).then(() => {}));
});
beforeEach(async () => {
  const { resetDb } = await import("../helpers/db");
  await resetDb();
});

async function refundRef(orderId: string, n = 0): Promise<string> {
  return (await getOrderDetail(orderId)).refunds[n].refundRef!;
}

async function drive(o: string, to: "PLACED" | "ACCEPTED" | "RIDER_ASSIGNED" | "PICKED_UP") {
  const steps: [string, OrderAction][] = [
    ["PLACED", "ACCEPT"],
    ["ACCEPTED", "ASSIGN_RIDER"],
    ["RIDER_ASSIGNED", "PICK_UP"],
  ];
  for (const [from, action] of steps) {
    if (from === to) return;
    const rider = (await listRiders("HK")).find((r) => r.isAvailable)!;
    await applyOpsAction(o, action, "OPS", action === "ASSIGN_RIDER" ? { riderId: rider.id } : {});
  }
}

describe("refunds", () => {
  const cases = [
    ["PLACED", "REJECT", "RESTAURANT_REJECTED"],
    ["ACCEPTED", "NO_RIDER", "NO_RIDER"],
    ["PICKED_UP", "FAIL_DELIVERY", "DELIVERY_FAILED"],
  ] as const;
  for (const [setup, action, reason] of cases) {
    it(`${action} from ${setup} starts a refund that settles to REFUNDED`, async () => {
      const o = await paidOrder();
      await drive(o, setup);
      await applyOpsAction(o, action, "OPS");
      const d = await getOrderDetail(o);
      expect(d.status).toBe("REFUND_PENDING");
      expect(d.failureReason).toBe(reason);
      expect(d.refunds).toHaveLength(1);
      expect(d.refunds[0]).toMatchObject({
        status: "PENDING",
        reason,
        amountCents: d.totalCents,
        idempotencyKey: `refund_${o}_1`,
      });
      await getFakeControls().decideRefund(d.refunds[0].refundRef!, "succeed");
      const after = await getOrderDetail(o);
      expect(after.status).toBe("REFUNDED");
      expect(after.refunds[0].status).toBe("SUCCEEDED");
      expect(after.events.at(-1)).toMatchObject({ toStatus: "REFUNDED", actor: "PROVIDER" });
    });
  }

  it("customer cancel of a PLACED order starts a refund", async () => {
    const o = await paidOrder();
    await cancelOrder(o, "u_mei");
    const d = await getOrderDetail(o);
    expect(d.status).toBe("REFUND_PENDING");
    expect(d.failureReason).toBe("CUSTOMER_CANCELLED");
    expect(d.refunds).toHaveLength(1);
  });

  it("cancel by another user is NotFound", async () => {
    const o = await paidOrder();
    await expect(cancelOrder(o, "u_arjun")).rejects.toBeInstanceOf(NotFound);
  });

  it("releases the rider after FAIL_DELIVERY from RIDER_ASSIGNED", async () => {
    const o = await paidOrder();
    await drive(o, "RIDER_ASSIGNED");
    const riderId = (await getOrderDetail(o)).delivery!.riderId!;
    await applyOpsAction(o, "FAIL_DELIVERY", "OPS");
    expect((await prisma.rider.findUnique({ where: { id: riderId } }))!.isAvailable).toBe(true);
    expect((await getOrderDetail(o)).delivery!.failedAt).not.toBeNull();
  });

  it("refund failure -> REFUND_FAILED -> RETRY_REFUND makes a second attempt; guard blocks a third", async () => {
    const o = await paidOrder();
    await applyOpsAction(o, "REJECT", "OPS");
    await getFakeControls().decideRefund(await refundRef(o), "fail");
    const failed = await getOrderDetail(o);
    expect(failed.status).toBe("REFUND_FAILED");
    expect(failed.refunds[0].status).toBe("FAILED");
    await applyOpsAction(o, "RETRY_REFUND", "OPS");
    const d = await getOrderDetail(o);
    expect(d.status).toBe("REFUND_PENDING");
    expect(d.refunds.map((r) => r.idempotencyKey)).toEqual([`refund_${o}_1`, `refund_${o}_2`]);
    await getFakeControls().decideRefund(d.refunds[1].refundRef!, "succeed");
    expect((await getOrderDetail(o)).status).toBe("REFUNDED");
    await startRefund(o);
    expect((await getOrderDetail(o)).refunds).toHaveLength(2);
  });

  it("a refund webhook for an order not in REFUND_PENDING only updates the record", async () => {
    const o = await paidOrder();
    await applyOpsAction(o, "REJECT", "OPS");
    await prisma.order.update({ where: { id: o }, data: { status: "CANCELLED" } });
    await getFakeControls().decideRefund(await refundRef(o), "succeed");
    const d = await getOrderDetail(o);
    expect(d.status).toBe("CANCELLED");
    expect(d.refunds[0].status).toBe("SUCCEEDED");
  });

  it("provider.refund throwing marks the refund FAILED and the order REFUND_FAILED (SYSTEM)", async () => {
    const o = await paidOrder();
    const spy = vi.spyOn(getProvider(), "refund").mockRejectedValueOnce(new Error("provider down"));
    await applyOpsAction(o, "REJECT", "OPS");
    spy.mockRestore();
    const d = await getOrderDetail(o);
    expect(d.refunds).toHaveLength(1);
    expect(d.refunds[0].status).toBe("FAILED");
    expect(d.refunds[0].failureReason).toBe("provider down");
    expect(d.status).toBe("REFUND_FAILED");
    expect(d.events.at(-1)).toMatchObject({ toStatus: "REFUND_FAILED", actor: "SYSTEM" });
  });

  it("late payment success on a moved-on order refunds without touching the order", async () => {
    await addItem("u_mei", { menuItemId: "hk_gd_har_gow", qty: 2, optionIds: [] });
    const { orderId } = await placeOrder("u_mei", "a_mei_hk");
    await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
    const p = await prisma.payment.findFirstOrThrow({ where: { orderId } });
    await getFakeControls().decideIntent(p.providerRef, "succeed");
    const d = await getOrderDetail(orderId);
    expect(d.status).toBe("CANCELLED");
    expect(d.payments[0].status).toBe("SUCCEEDED");
    expect(d.refunds).toHaveLength(1);
    expect(d.refunds[0]).toMatchObject({ reason: "late_payment", status: "PENDING" });
    expect(d.flags).toContain("LATE_PAYMENT_REFUNDED");
  });

  it("a failed local write after the provider accepted the refund leaves it PENDING (no double refund)", async () => {
    const o = await paidOrder();
    const spy = vi.spyOn(prisma.refund, "update").mockRejectedValueOnce(new Error("db write failed"));
    await expect(applyOpsAction(o, "REJECT", "OPS")).rejects.toThrow("db write failed");
    spy.mockRestore();
    const d = await getOrderDetail(o);
    expect(d.refunds).toHaveLength(1);
    expect(d.refunds[0].status).toBe("PENDING");
    expect(d.status).toBe("REFUND_PENDING");
    expect(d.status).not.toBe("REFUND_FAILED");
    // a retry is a no-op while the refund is PENDING
    await startRefund(o);
    expect((await getOrderDetail(o)).refunds).toHaveLength(1);
  });

  it("targets the late payment for the late refund, then the live payment on reject", async () => {
    const o = await paidOrder();
    const live = await prisma.payment.findFirstOrThrow({ where: { orderId: o } });
    await startPayment(o);
    const late = await prisma.payment.findFirstOrThrow({ where: { orderId: o, id: { not: live.id } } });
    await getFakeControls().decideIntent(late.providerRef, "succeed");
    let d = await getOrderDetail(o);
    expect(d.status).toBe("PLACED");
    expect(d.refunds).toHaveLength(1);
    expect(d.refunds[0]).toMatchObject({ reason: "late_payment", paymentId: late.id });
    expect(d.flags).toContain("LATE_PAYMENT_REFUNDED");

    await applyOpsAction(o, "REJECT", "OPS");
    d = await getOrderDetail(o);
    expect(d.status).toBe("REFUND_PENDING");
    expect(d.refunds).toHaveLength(2);
    const reject = d.refunds.find((r) => r.reason !== "late_payment")!;
    expect(reject.paymentId).toBe(live.id);
    await getFakeControls().decideRefund(reject.refundRef!, "succeed");
    expect((await getOrderDetail(o)).status).toBe("REFUNDED");
  });
});
