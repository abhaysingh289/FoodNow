import { afterEach, describe, expect, it, vi } from "vitest";
import { PromoInvalid } from "@/lib/errors";
import { handle, toErrorResponse } from "@/lib/http";

afterEach(() => vi.restoreAllMocks());

describe("toErrorResponse", () => {
  it("maps a DomainError to its status and body", async () => {
    const r = toErrorResponse(new PromoInvalid("Minimum spend is HK$100.00"));
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ error: { code: "PROMO_INVALID", message: "Minimum spend is HK$100.00" } });
  });

  it("maps unexpected errors to 500 INTERNAL and logs them", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = toErrorResponse(new Error("boom"));
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: { code: "INTERNAL", message: "Something went wrong" } });
    expect(spy).toHaveBeenCalled();
  });
});

describe("handle", () => {
  it("returns 200 JSON of the result", async () => {
    const r = await handle(async () => ({ ok: true }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });

  it("maps thrown domain errors", async () => {
    const r = await handle(async () => {
      throw new PromoInvalid("nope");
    });
    expect(r.status).toBe(422);
  });
});
