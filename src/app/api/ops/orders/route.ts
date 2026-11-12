import { handle } from "@/lib/http";
import { listOpsOrders } from "@/modules/orders";

export const dynamic = "force-dynamic";

export const GET = () => handle(() => listOpsOrders());
