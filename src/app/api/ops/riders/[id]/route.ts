import { handle, readJson, reqBoolean } from "@/lib/http";
import { setRiderAvailability } from "@/modules/delivery";

export const PATCH = (req: Request, ctx: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const { id } = await ctx.params;
    const body = await readJson(req);
    return setRiderAvailability(id, reqBoolean(body, "isAvailable"));
  });
