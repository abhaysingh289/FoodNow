import { handle, optString, readJson, reqAction } from "@/lib/http";
import { applyOpsAction } from "@/modules/orders";

export const POST = (req: Request, ctx: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const { id } = await ctx.params;
    const body = await readJson(req);
    return applyOpsAction(id, reqAction(body), "OPS", {
      riderId: optString(body, "riderId"),
      note: optString(body, "note"),
    });
  });
