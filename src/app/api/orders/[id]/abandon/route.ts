import { handle } from "@/lib/http";
import { getSession } from "@/lib/session";
import { abandonOrder } from "@/modules/orders";

export const POST = (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const { id } = await ctx.params;
    const s = await getSession();
    return abandonOrder(id, s.user.id);
  });
