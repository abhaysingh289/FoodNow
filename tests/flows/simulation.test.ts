import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { addItem } from "@/modules/cart";
import { getOrderDetail, placeOrder } from "@/modules/orders";
import { applyOpsAction } from "@/modules/orders/actions";
import { handleWebhook } from "@/modules/payments";
import { getFakeControls, setWebhookTransport } from "@/modules/payments/registry";
import { getSettings, tick, updateSettings } from "@/modules/simulation";
import { paidOrder } from "../helpers/orders";

beforeAll(() => {
  setWebhookTransport((body, h) => handleWebhook("fake", body, new Headers(h)).then(() => {}));
});
beforeEach(async () => {
  const { resetDb } = await import("../helpers/db");
  await resetDb();
});

async function lastEventAt(orderId: string): Promise<Date> {
  const e = await prisma.orderEvent.findFirstOrThrow({ where: { orderId }, orderBy: { createdAt: "desc" } });
  return e.createdAt;
}
const addSec = (d: Date, s: number) => new Date(d.getTime() + s * 1000);

describe("simulation settings", () => {
  it("reads defaults and updates", async () => {
    expect(await getSettings()).toEqual({ autoMode: false, stepDelaySeconds: 5 });
    expect(await updateSettings({ autoMode: true, stepDelaySeconds: 7 })).toEqual({ autoMode: true, stepDelaySeconds: 7 });
    expect(await getSettings()).toEqual({ autoMode: true, stepDelaySeconds: 7 });
  });
  it("rejects delays outside 1-60 or non-integer", async () => {
    for (const v of [0, 61, 2.5]) {
      await expect(updateSettings({ stepDelaySeconds: v })).rejects.toBeInstanceOf(ValidationError);
    }
  });
});

describe("tick", () => {
  it("does nothing when auto mode is off", async () => {
    const o = await paidOrder();
    const t0 = await lastEventAt(o);
    expect((await tick(addSec(t0, 999))).advanced).toEqual([]);
    expect((await getOrderDetail(o)).status).toBe("PLACED");
  });

  it("advances one step per tick along the happy path with AUTO events", async () => {
    await updateSettings({ autoMode: true, stepDelaySeconds: 5 });
    const o = await paidOrder();
    const t0 = await lastEventAt(o);
    expect((await tick(addSec(t0, 2))).advanced).toEqual([]);
    expect((await tick(addSec(t0, 6))).advanced).toEqual([o]);
    expect((await getOrderDetail(o)).events.at(-1)).toMatchObject({ toStatus: "ACCEPTED", actor: "AUTO" });
    for (const status of ["RIDER_ASSIGNED", "PICKED_UP", "DELIVERED"]) {
      const t = await lastEventAt(o);
      expect((await tick(addSec(t, 6))).advanced).toEqual([o]);
      expect((await getOrderDetail(o)).events.at(-1)).toMatchObject({ toStatus: status, actor: "AUTO" });
    }
    const t = await lastEventAt(o);
    expect((await tick(addSec(t, 60))).advanced).toEqual([]);
  });

  it("succeeds a pending fake intent so the order becomes PLACED", async () => {
    await updateSettings({ autoMode: true, stepDelaySeconds: 5 });
    await addItem("u_mei", { menuItemId: "hk_gd_har_gow", qty: 1, optionIds: [] });
    const { orderId } = await placeOrder("u_mei", "a_mei_hk");
    const p = await prisma.payment.findFirstOrThrow({ where: { orderId } });
    expect((await tick(new Date())).advanced).toEqual([]);
    const r = await tick(addSec(new Date(), 6));
    expect(r.advanced).toEqual([p.providerRef]);
    expect((await getOrderDetail(orderId)).status).toBe("PLACED");
  });

  it("leaves ACCEPTED orders alone when no rider is free", async () => {
    await updateSettings({ autoMode: true, stepDelaySeconds: 5 });
    const o = await paidOrder();
    await applyOpsAction(o, "ACCEPT", "OPS");
    await prisma.rider.updateMany({ where: { country: "HK" }, data: { isAvailable: false } });
    const t = await lastEventAt(o);
    expect((await tick(addSec(t, 6))).advanced).toEqual([]);
    expect((await getOrderDetail(o)).status).toBe("ACCEPTED");
  });

  it("never touches PAYMENT_FAILED orders", async () => {
    await updateSettings({ autoMode: true, stepDelaySeconds: 5 });
    await addItem("u_mei", { menuItemId: "hk_gd_har_gow", qty: 1, optionIds: [] });
    const { orderId } = await placeOrder("u_mei", "a_mei_hk");
    const p = await prisma.payment.findFirstOrThrow({ where: { orderId } });
    await getFakeControls().decideIntent(p.providerRef, "fail");
    expect((await getOrderDetail(orderId)).status).toBe("PAYMENT_FAILED");
    const t = await lastEventAt(orderId);
    expect((await tick(addSec(t, 999))).advanced).toEqual([]);
    expect((await getOrderDetail(orderId)).status).toBe("PAYMENT_FAILED");
  });

  it("settles a pending fake refund so the order becomes REFUNDED", async () => {
    await updateSettings({ autoMode: true, stepDelaySeconds: 5 });
    const o = await paidOrder();
    await applyOpsAction(o, "REJECT", "OPS");
    const d = await getOrderDetail(o);
    expect(d.status).toBe("REFUND_PENDING");
    const ref = d.refunds[0].refundRef!;
    expect((await tick(addSec(new Date(), 6))).advanced).toEqual([ref]);
    expect((await getOrderDetail(o)).status).toBe("REFUNDED");
  });

  it("retries a failed refund", async () => {
    await updateSettings({ autoMode: true, stepDelaySeconds: 5 });
    const o = await paidOrder();
    await applyOpsAction(o, "REJECT", "OPS");
    const ref = (await getOrderDetail(o)).refunds[0].refundRef!;
    await getFakeControls().decideRefund(ref, "fail");
    expect((await getOrderDetail(o)).status).toBe("REFUND_FAILED");
    const t = await lastEventAt(o);
    const r = await tick(addSec(t, 6));
    expect(r.advanced).toEqual([o]);
    expect((await getOrderDetail(o)).status).toBe("REFUND_PENDING");
  });
});
