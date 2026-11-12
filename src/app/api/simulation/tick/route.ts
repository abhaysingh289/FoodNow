import { handle } from "@/lib/http";
import { tick } from "@/modules/simulation";

export const POST = () => handle(() => tick());
