import { handle } from "@/lib/http";
import { getFakeControls } from "@/modules/payments/registry";

export const dynamic = "force-dynamic";

export const GET = () => handle(async () => getFakeControls().listItems());
