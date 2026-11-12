import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { NotFound, RiderUnavailable } from "@/lib/errors";
import {
  assignRider, firstAvailableRider, listRiders, markDelivery, releaseRider, setRiderAvailability,
} from "@/modules/delivery";
import { resetDb } from "../helpers/db";
import { insertOrder } from "../helpers/fixtures";

describe("riders", () => {
  beforeAll(async () => {
    await resetDb();
  });

  it("assigns, rejects busy and cross-country riders, lists, and releases", async () => {
    const orderA = await insertOrder({ status: "ACCEPTED", country: "HK" });
    const orderB = await insertOrder({ status: "ACCEPTED", country: "HK" });
    const hkRider = (await listRiders("HK"))[0];
    const sgRider = (await listRiders("SG"))[0];

    await prisma.$transaction((tx) => assignRider(tx, orderA, hkRider.id));
    await expect(prisma.$transaction((tx) => assignRider(tx, orderB, hkRider.id))).rejects.toBeInstanceOf(RiderUnavailable);
    await expect(prisma.$transaction((tx) => assignRider(tx, orderB, sgRider.id))).rejects.toBeInstanceOf(RiderUnavailable);
    await expect(prisma.$transaction((tx) => assignRider(tx, "nope", sgRider.id))).rejects.toBeInstanceOf(NotFound);
    expect((await prisma.order.findUnique({ where: { id: orderB } }))!.status).toBe("ACCEPTED");
    expect((await listRiders("HK")).find((r) => r.id === hkRider.id)!.currentOrderId).toBe(orderA);

    await expect(setRiderAvailability(hkRider.id, true)).rejects.toThrow("Rider is on an active delivery");
    await prisma.$transaction((tx) => markDelivery(tx, orderA, "deliveredAt"));
    expect((await listRiders("HK")).find((r) => r.id === hkRider.id)!.currentOrderId).toBeNull();

    await prisma.$transaction((tx) => releaseRider(tx, orderA));
    expect((await prisma.rider.findUnique({ where: { id: hkRider.id } }))!.isAvailable).toBe(true);
    await prisma.$transaction((tx) => releaseRider(tx, orderB)); // no-op
  });

  it("toggles availability and finds first available", async () => {
    const r = (await listRiders("SG"))[0];
    expect((await setRiderAvailability(r.id, false)).isAvailable).toBe(false);
    expect((await firstAvailableRider("SG"))!.id).not.toBe(r.id);
    await setRiderAvailability(r.id, true);
    expect((await firstAvailableRider("SG"))!.id).toBe(r.id);
  });
});
