import { ValidationError } from "@/lib/errors";
import { handle } from "@/lib/http";
import { getSession } from "@/lib/session";
import { listOrdersForUser, placeOrder } from "@/modules/orders";

export const dynamic = "force-dynamic";

export const POST = () =>
  handle(async () => {
    const s = await getSession();
    return placeOrder(s.user.id, s.address.id);
  });

export const GET = (req: Request) =>
  handle(async () => {
    const tab = new URL(req.url).searchParams.get("tab") ?? "active";
    if (tab !== "active" && tab !== "history") throw new ValidationError("tab must be active or history");
    const s = await getSession();
    return listOrdersForUser(s.user.id, tab);
  });
