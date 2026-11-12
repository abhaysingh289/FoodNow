import { NextResponse } from "next/server";
import { optString, readJson, toErrorResponse } from "@/lib/http";
import { resolveSession, SESSION_COOKIES } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const session = await resolveSession({
      userId: optString(body, "userId"),
      country: optString(body, "country"),
      addressId: optString(body, "addressId"),
    });
    const res = NextResponse.json(session);
    const opts = { path: "/", httpOnly: false, sameSite: "lax" as const };
    res.cookies.set(SESSION_COOKIES.user, session.user.id, opts);
    res.cookies.set(SESSION_COOKIES.country, session.country, opts);
    res.cookies.set(SESSION_COOKIES.address, session.address.id, opts);
    return res;
  } catch (err) {
    return toErrorResponse(err);
  }
}
