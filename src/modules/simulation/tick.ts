import { prisma } from "@/lib/db";
import { firstAvailableRider } from "@/modules/delivery";
import { type OrderAction } from "@/modules/orders";
import { applyOpsAction } from "@/modules/orders/actions";
import { getFakeControls } from "@/modules/payments/registry";
import { getSettings } from "./settings";

const STEPS: Record<string, OrderAction> = {
  PLACED: "ACCEPT",
  ACCEPTED: "ASSIGN_RIDER",
  RIDER_ASSIGNED: "PICK_UP",
  PICKED_UP: "DELIVER",
  REFUND_FAILED: "RETRY_REFUND",
};

function warn(what: string, err: unknown) {
  console.warn(`[simulation] skipped ${what}:`, err instanceof Error ? err.message : err);
}

/** Advances every due item one happy-path step. Errors per item are skipped. */
export async function tick(now: Date = new Date()): Promise<{ advanced: string[] }> {
  const { autoMode, stepDelaySeconds } = await getSettings();
  if (!autoMode) return { advanced: [] };
  const cutoff = now.getTime() - stepDelaySeconds * 1000;
  const due = (d: Date) => d.getTime() <= cutoff;

  // Snapshot all candidates before acting, so each order moves at most one step.
  const fakeEnabled = (process.env.PAYMENT_PROVIDER ?? "fake") === "fake";
  const fakeDue = fakeEnabled
    ? (await getFakeControls().listItems()).filter(
        (i) => due(i.updatedAt) && (i.kind === "intent" ? ["REQUIRES_ACTION", "PENDING"].includes(i.status) : i.status === "PENDING"),
      )
    : [];

  const candidates = await prisma.order.findMany({
    where: { status: { in: Object.keys(STEPS) } },
    select: { id: true, status: true, country: true, events: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
  });
  const dueOrders = candidates.filter((o) => o.events[0] && due(o.events[0].createdAt));

  const advanced: string[] = [];
  const touched = new Set<string>();

  for (const item of fakeDue) {
    try {
      if (item.kind === "intent") {
        const p = await prisma.payment.findUnique({ where: { providerRef: item.ref } });
        if (p) touched.add(p.orderId);
        await getFakeControls().decideIntent(item.ref, "succeed");
      } else {
        const r = await prisma.refund.findUnique({ where: { refundRef: item.ref }, include: { payment: true } });
        if (r) touched.add(r.payment.orderId);
        await getFakeControls().decideRefund(item.ref, "succeed");
      }
      advanced.push(item.ref);
    } catch (err) {
      warn(item.ref, err);
    }
  }

  for (const o of dueOrders) {
    if (touched.has(o.id)) continue;
    try {
      const action = STEPS[o.status];
      if (action === "ASSIGN_RIDER") {
        const rider = await firstAvailableRider(o.country);
        if (!rider) continue;
        await applyOpsAction(o.id, action, "AUTO", { riderId: rider.id });
      } else {
        await applyOpsAction(o.id, action, "AUTO");
      }
      advanced.push(o.id);
    } catch (err) {
      warn(o.id, err);
    }
  }
  return { advanced };
}
