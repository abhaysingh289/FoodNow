import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { InvalidTransition, ValidationError } from "@/lib/errors";
import { listRiders } from "@/modules/delivery";
import { getOrderDetail, listOrdersForUser } from "@/modules/orders";
import { applyOpsAction, cancelOrder } from "@/modules/orders/actions";
import { handleWebhook } from "@/modules/payments";
import { setWebhookTransport } from "@/modules/payments/registry";
import { paidOrder } from "../helpers/orders";

beforeAll(() => {
  setWebhookTransport((body, h) => handleWebhook("fake", body, new Headers(h)).then(() => {}));
});
beforeEach(async () => {
  const { resetDb } = await import("../helpers/db");
  await resetDb();
});

describe("fulfilment", () => {
  it("walks ACCEPT -> ASSIGN_RIDER -> PICK_UP -> DELIVER with ETA, delivery stamps and rider release", async () => {
    const o = await paidOrder();
    const rider = (await listRiders("HK"))[0];
    expect((await applyOpsAction(o, "ACCEPT", "OPS")).etaMinutes).toBe(33);
    const assigned = await applyOpsAction(o, "ASSIGN_RIDER", "OPS", { riderId: rider.id });
    expect(assigned.status).toBe("RIDER_ASSIGNED");
    expect((await prisma.rider.findUnique({ where: { id: rider.id } }))!.isAvailable).toBe(false);
    expect((await applyOpsAction(o, "PICK_UP", "OPS")).etaMinutes).toBe(13);
    expect((await getOrderDetail(o)).delivery!.pickedUpAt).not.toBeNull();
    const done = await applyOpsAction(o, "DELIVER", "OPS");
    expect(done.status).toBe("DELIVERED");
    expect(done.etaMinutes).toBe(0);
    expect((await getOrderDetail(o)).delivery!.deliveredAt).not.toBeNull();
    expect((await prisma.rider.findUnique({ where: { id: rider.id } }))!.isAvailable).toBe(true);
    expect((await listOrdersForUser("u_mei", "history")).map((x) => x.id)).toContain(o);
  });

  it("requires a riderId for ASSIGN_RIDER and leaves the order untouched", async () => {
    const o = await paidOrder();
    await applyOpsAction(o, "ACCEPT", "OPS");
    await expect(applyOpsAction(o, "ASSIGN_RIDER", "OPS", {})).rejects.toBeInstanceOf(ValidationError);
    expect((await getOrderDetail(o)).status).toBe("ACCEPTED");
  });

  it("blocks customer cancel after ACCEPTED", async () => {
    const o = await paidOrder();
    await applyOpsAction(o, "ACCEPT", "OPS");
    await expect(cancelOrder(o, "u_mei")).rejects.toBeInstanceOf(InvalidTransition);
  });
});
