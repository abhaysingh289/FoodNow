import { notFound } from "next/navigation";
import { NotFound } from "@/lib/errors";
import { getSession } from "@/lib/session";
import { allowedActions, getOrderDetail, type OrderStatus } from "@/modules/orders";
import { OrderTracker, type OrderView } from "../../_components/OrderTracker";

export default async function TrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  let order;
  try {
    order = await getOrderDetail(id);
  } catch (err) {
    if (err instanceof NotFound) notFound();
    throw err;
  }
  if (order.userId !== session.user.id) notFound();

  // Same JSON shape the polling endpoint returns (dates become ISO strings).
  const { webhookLogs: _logs, ...rest } = order;
  const initial = JSON.parse(
    JSON.stringify({ ...rest, allowedActions: allowedActions(order.status as OrderStatus, "CUSTOMER") }),
  ) as OrderView;
  return <OrderTracker initial={initial} />;
}
