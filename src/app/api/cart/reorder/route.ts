import { handle, readJson, reqString } from "@/lib/http";
import { getSession } from "@/lib/session";
import { reorder } from "@/modules/cart";

export const POST = (req: Request) =>
  handle(async () => {
    const body = await readJson(req);
    const s = await getSession();
    return reorder(s.user.id, reqString(body, "orderId"));
  });
