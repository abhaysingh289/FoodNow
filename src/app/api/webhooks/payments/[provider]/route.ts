import { toErrorResponse } from "@/lib/http";
import { handleWebhook } from "@/modules/payments";

export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await ctx.params;
    const { httpStatus, result } = await handleWebhook(provider, await req.text(), req.headers);
    return Response.json({ result }, { status: httpStatus });
  } catch (err) {
    return toErrorResponse(err);
  }
}
