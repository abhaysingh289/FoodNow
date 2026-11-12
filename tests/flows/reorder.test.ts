import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { NotFound, RestaurantClosed } from "@/lib/errors";
import { clearCart, getCart, reorder } from "@/modules/cart";
import { listRiders } from "@/modules/delivery";
import { applyOpsAction } from "@/modules/orders/actions";
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

async function deliver(o: string) {
  const rider = (await listRiders("HK"))[0];
  await applyOpsAction(o, "ACCEPT", "OPS");
  await applyOpsAction(o, "ASSIGN_RIDER", "OPS", { riderId: rider.id });
  await applyOpsAction(o, "PICK_UP", "OPS");
  await applyOpsAction(o, "DELIVER", "OPS");
}

async function wontonAndLobster(): Promise<string> {
  await prisma.menuItem.update({ where: { id: "hk_gd_lobster" }, data: { isAvailable: true } });
  const o = await paidOrder([
    { menuItemId: "hk_gd_wonton", qty: 2, optionIds: ["opt_wonton_large", "opt_wonton_chili"] },
    { menuItemId: "hk_gd_lobster", qty: 1 },
  ]);
  await deliver(o);
  return o;
}

const addr = () => prisma.address.findUniqueOrThrow({ where: { id: "a_mei_hk" } });

describe("reorder", () => {
  it("rebuilds the cart, skipping unavailable items and preserving qty and options", async () => {
    const o = await wontonAndLobster();
    await prisma.menuItem.update({ where: { id: "hk_gd_lobster" }, data: { isAvailable: false } });
    const { skipped } = await reorder("u_mei", o);
    expect(skipped).toEqual(["Lobster Dumplings"]);
    const cart = await getCart("u_mei", await addr());
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]).toMatchObject({ menuItemId: "hk_gd_wonton", qty: 2 });
    expect(cart.lines[0].options.map((x) => x.id).sort()).toEqual(["opt_wonton_chili", "opt_wonton_large"]);
  });

  it("replaces an existing cart rather than appending", async () => {
    const o = await wontonAndLobster();
    await prisma.menuItem.update({ where: { id: "hk_gd_lobster" }, data: { isAvailable: true } });
    expect((await reorder("u_mei", o)).skipped).toEqual([]);
    await reorder("u_mei", o);
    const lines = (await getCart("u_mei", await addr())).lines;
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.qty).sort()).toEqual([1, 2]);
  });

  it("skips a line whose snapshotted option no longer exists", async () => {
    const o = await wontonAndLobster();
    await prisma.menuItem.update({ where: { id: "hk_gd_lobster" }, data: { isAvailable: true } });
    await prisma.modifierOption.update({ where: { id: "opt_wonton_chili" }, data: { name: "Renamed" } });
    const { skipped } = await reorder("u_mei", o);
    const wonton = await prisma.orderItem.findFirstOrThrow({ where: { orderId: o, menuItemId: "hk_gd_wonton" } });
    expect(skipped).toEqual([wonton.nameSnapshot]);
  });

  it("leaves the cart empty and returns all names when everything is skipped", async () => {
    const o = await wontonAndLobster();
    await prisma.menuItem.updateMany({
      where: { id: { in: ["hk_gd_wonton", "hk_gd_lobster"] } },
      data: { isAvailable: false },
    });
    await clearCart("u_mei");
    const { skipped } = await reorder("u_mei", o);
    expect(skipped).toHaveLength(2);
    expect((await getCart("u_mei", await addr())).lines).toHaveLength(0);
  });

  it("fails RestaurantClosed when the restaurant is closed", async () => {
    const o = await wontonAndLobster();
    await prisma.restaurant.update({ where: { id: "hk_golden_dragon" }, data: { isOpen: false } });
    await expect(reorder("u_mei", o)).rejects.toBeInstanceOf(RestaurantClosed);
  });

  it("is NotFound for another user's order", async () => {
    const o = await wontonAndLobster();
    await expect(reorder("u_arjun", o)).rejects.toBeInstanceOf(NotFound);
  });
});
