import { handle, optBoolean, optString, optStringArray, readJson, reqNumber, reqString } from "@/lib/http";
import { getSession } from "@/lib/session";
import { addItem } from "@/modules/cart";

export const POST = (req: Request) =>
  handle(async () => {
    const body = await readJson(req);
    const s = await getSession();
    await addItem(s.user.id, {
      menuItemId: reqString(body, "menuItemId"),
      qty: reqNumber(body, "qty"),
      optionIds: optStringArray(body, "optionIds"),
      note: optString(body, "note"),
      replaceCart: optBoolean(body, "replaceCart"),
    });
    return { ok: true };
  });
