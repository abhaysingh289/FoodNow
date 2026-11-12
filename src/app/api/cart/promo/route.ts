import { ValidationError } from "@/lib/errors";
import { handle, readJson } from "@/lib/http";
import { getSession } from "@/lib/session";
import { setPromo } from "@/modules/cart";

export const PUT = (req: Request) =>
  handle(async () => {
    const body = await readJson(req);
    const code = body.code ?? null;
    if (code !== null && typeof code !== "string") throw new ValidationError("code must be a string or null");
    const s = await getSession();
    await setPromo(s.user.id, code, s.country);
    return { ok: true };
  });
