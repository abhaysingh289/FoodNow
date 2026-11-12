import { handle, optBoolean, optNumber, readJson } from "@/lib/http";
import { getSettings, updateSettings } from "@/modules/simulation";

export const dynamic = "force-dynamic";

export const GET = () => handle(() => getSettings());

export const PATCH = (req: Request) =>
  handle(async () => {
    const body = await readJson(req);
    return updateSettings({
      autoMode: optBoolean(body, "autoMode"),
      stepDelaySeconds: optNumber(body, "stepDelaySeconds"),
    });
  });
