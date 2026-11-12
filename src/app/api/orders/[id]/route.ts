import { NotFound } from "@/lib/errors";
import { handle } from "@/lib/http";
import { getSession } from "@/lib/session";
import { allowedActions, getOrderDetail, type OrderStatus } from "@/modules/orders";

export const dynamic = "force-dynamic";

export const GET = (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const { id } = await ctx.params;
    const s = await getSession();
    const order = await getOrderDetail(id);
    if (order.userId !== s.user.id) throw new NotFound("Order not found");
    return { ...order, allowedActions: allowedActions(order.status as OrderStatus, "CUSTOMER") };
  });
