import { beforeEach, describe, expect, it } from "vitest";
import { handleWebhook } from "@/modules/payments";
import { setWebhookTransport } from "@/modules/payments/registry";
import { resetDb } from "../helpers/db";
import { paidOrder } from "../helpers/orders";
import { POST as webhookPOST } from "@/app/api/webhooks/payments/[provider]/route";
import { POST as opsActionPOST } from "@/app/api/ops/orders/[id]/actions/route";
import { PATCH as simulationPATCH } from "@/app/api/simulation/route";

beforeEach(async () => {
  await resetDb();
  setWebhookTransport((body, h) => handleWebhook("fake", body, new Headers(h)).then(() => {}));
});

const json = (body: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body) });

describe("API routes", () => {
  it("webhook with a bad signature answers 400", async () => {
    const res = await webhookPOST(
      new Request("http://x/api/webhooks/payments/fake", {
        method: "POST",
        body: "{}",
        headers: { "x-fake-signature": "bad" },
      }),
      { params: Promise.resolve({ provider: "fake" }) },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).result).toBe("REJECTED");
  });

  it("ops action with an invalid transition answers 409 INVALID_TRANSITION", async () => {
    const placedOrderId = await paidOrder();
    const bad = await opsActionPOST(json({ action: "DELIVER" }), { params: Promise.resolve({ id: placedOrderId }) });
    expect(bad.status).toBe(409);
    expect((await bad.json()).error.code).toBe("INVALID_TRANSITION");
  });

  it("ops action with an unknown action answers 400 VALIDATION_ERROR", async () => {
    const id = await paidOrder();
    const bad = await opsActionPOST(json({ action: "EXPLODE" }), { params: Promise.resolve({ id }) });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("PATCH /api/simulation rejects a non-boolean autoMode", async () => {
    const res = await simulationPATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ autoMode: "yes" }) }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });
});
