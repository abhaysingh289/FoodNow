import type {
  Delivery, Order, OrderEvent, OrderItem, Payment, Refund, Restaurant, Rider, WebhookLog,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotFound } from "@/lib/errors";
import type { FailureReason, OrderStatus } from "./stateMachine";

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
