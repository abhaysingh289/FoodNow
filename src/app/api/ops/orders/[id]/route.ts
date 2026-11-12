import { handle } from "@/lib/http";
import { getOrderDetail } from "@/modules/orders";

export const dynamic = "force-dynamic";

export const GET = (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
  handle(async () => getOrderDetail((await ctx.params).id));
