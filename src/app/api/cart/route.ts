import { handle } from "@/lib/http";
import { getSession } from "@/lib/session";
import { getCart } from "@/modules/cart";

export const dynamic = "force-dynamic";

export const GET = () =>
  handle(async () => {
    const s = await getSession();
    return getCart(s.user.id, s.address);
  });
