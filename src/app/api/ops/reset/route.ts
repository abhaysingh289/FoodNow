import { resetAll } from "@/lib/admin";
import { handle } from "@/lib/http";

export const POST = () =>
  handle(async () => {
    await resetAll();
    return { ok: true };
  });
