import { handle, readJson, reqNumber } from "@/lib/http";
import { getSession } from "@/lib/session";
import { updateQty } from "@/modules/cart";

export const PATCH = (req: Request, ctx: { params: Promise<{ lineId: string }> }) =>
  handle(async () => {
    const { lineId } = await ctx.params;
    const body = await readJson(req);
    const s = await getSession();
    await updateQty(s.user.id, lineId, reqNumber(body, "qty"));
    return { ok: true };
  });
