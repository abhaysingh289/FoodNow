import { handle } from "@/lib/http";
import { listRiders } from "@/modules/delivery";

export const dynamic = "force-dynamic";

export const GET = (req: Request) =>
  handle(() => listRiders(new URL(req.url).searchParams.get("country") ?? "HK"));
