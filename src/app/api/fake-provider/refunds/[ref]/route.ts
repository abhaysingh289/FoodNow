import { DECISION_MODES, handle, optOneOf, readJson, reqOneOf } from "@/lib/http";
import { getFakeControls } from "@/modules/payments/registry";

export const POST = (req: Request, ctx: { params: Promise<{ ref: string }> }) =>
  handle(async () => {
    const { ref } = await ctx.params;
    const body = await readJson(req);
    const outcome = reqOneOf(body, "outcome", ["succeed", "fail"] as const);
    await getFakeControls().decideRefund(ref, outcome, optOneOf(body, "mode", DECISION_MODES));
    return { ok: true };
  });
