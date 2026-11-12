import { DECISION_MODES, handle, optOneOf, readJson, reqOneOf } from "@/lib/http";
import { getFakeControls } from "@/modules/payments/registry";

export const POST = (req: Request, ctx: { params: Promise<{ ref: string }> }) =>
  handle(async () => {
    const { ref } = await ctx.params;
    const body = await readJson(req);
    const outcome = reqOneOf(body, "outcome", ["succeed", "fail", "pending"] as const);
    const mode = optOneOf(body, "mode", DECISION_MODES);
    const fake = getFakeControls();
    if (outcome === "pending") await fake.leavePending(ref);
    else await fake.decideIntent(ref, outcome, mode);
    return { ok: true };
  });
