import { handle, readJson, reqOneOf, reqString } from "@/lib/http";
import { getFakeControls } from "@/modules/payments/registry";

export const POST = (req: Request) =>
  handle(async () => {
    const body = await readJson(req);
    await getFakeControls().resend(reqOneOf(body, "kind", ["intent", "refund"] as const), reqString(body, "ref"));
    return { ok: true };
  });
