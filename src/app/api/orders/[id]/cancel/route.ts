import { handle } from "@/lib/http";
import { getSession } from "@/lib/session";
import { cancelOrder } from "@/modules/orders";

export const POST = (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const { id } = await ctx.params;
    const s = await getSession();
    return cancelOrder(id, s.user.id);
  });
