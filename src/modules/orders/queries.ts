import type {
  Delivery, Order, OrderEvent, OrderItem, Payment, Refund, Restaurant, Rider, WebhookLog,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotFound } from "@/lib/errors";
import { allowedActions, type FailureReason, type OrderAction, type OrderStatus } from "./stateMachine";

export type OrderDetail = Order & {
  items: OrderItem[];
  events: OrderEvent[];
  payments: Payment[];
  refunds: Refund[];
  delivery: (Delivery & { rider: Rider | null }) | null;
  restaurant: Restaurant;
  webhookLogs: WebhookLog[];
  flags: string[];
};

export type OrderSummary = {
  id: string;
  restaurantName: string;
  createdAt: Date;
  totalCents: number;
  country: string;
  status: OrderStatus;
  failureReason: FailureReason | null;
};

export async function getOrderDetail(orderId: string): Promise<OrderDetail> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { orderBy: { id: "asc" } },
      events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      payments: { orderBy: { createdAt: "asc" }, include: { refunds: { orderBy: { createdAt: "asc" } } } },
      delivery: { include: { rider: true } },
      restaurant: true,
    },
  });
  if (!order) throw new NotFound("Order not found");
  const webhookLogs = await prisma.webhookLog.findMany({
    where: { orderId },
    orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
  });
  const refunds = order.payments.flatMap((p) => p.refunds);
  const payments = order.payments.map(({ refunds: _refunds, ...p }) => p);
  const flags: string[] = [];
  if (webhookLogs.some((l) => l.result === "MISMATCH")) flags.push("AMOUNT_MISMATCH");
  if (refunds.some((r) => r.reason === "late_payment")) flags.push("LATE_PAYMENT_REFUNDED");
  return { ...order, payments, refunds, webhookLogs, flags };
}

const HISTORY: OrderStatus[] = ["DELIVERED", "CANCELLED", "REFUNDED"];

export async function listOrdersForUser(userId: string, tab: "active" | "history"): Promise<OrderSummary[]> {
  const orders = await prisma.order.findMany({
    where: { userId, status: tab === "history" ? { in: HISTORY } : { notIn: HISTORY } },
    include: { restaurant: { select: { name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return orders.map((o) => ({
    id: o.id,
    restaurantName: o.restaurant.name,
    createdAt: o.createdAt,
    totalCents: o.totalCents,
    country: o.country,
    status: o.status as OrderStatus,
    failureReason: o.failureReason as FailureReason | null,
  }));
}

export type OpsOrderSummary = OrderSummary & {
  etaMinutes: number | null;
  riderName: string | null;
  allowedActions: OrderAction[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Ops board feed: every non-terminal order plus terminal ones updated in the last 24 h, newest first. */
export async function listOpsOrders(): Promise<OpsOrderSummary[]> {
  const since = new Date(Date.now() - DAY_MS);
  const orders = await prisma.order.findMany({
    where: { OR: [{ status: { notIn: HISTORY } }, { status: { in: HISTORY }, updatedAt: { gte: since } }] },
    include: { restaurant: { select: { name: true } }, delivery: { include: { rider: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return orders.map((o) => ({
    id: o.id,
    restaurantName: o.restaurant.name,
    createdAt: o.createdAt,
    totalCents: o.totalCents,
    country: o.country,
    status: o.status as OrderStatus,
    failureReason: o.failureReason as FailureReason | null,
    etaMinutes: o.etaMinutes,
    riderName: o.delivery?.rider?.name ?? null,
    allowedActions: allowedActions(o.status as OrderStatus, "OPS"),
  }));
}
