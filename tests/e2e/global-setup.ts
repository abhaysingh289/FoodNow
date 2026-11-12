/**
 * `next dev` compiles each route on first request, and a compile landing mid-navigation makes
 * clicks and refreshes slow or flaky. Hit every route the customer flow and the ops console use once up front.
 * API calls use empty bodies or an unknown order id, so they compile the route and fail without side effects.
 * (POST /api/orders is left out on purpose: it would place a real order for the default session.)
 * POST /api/ops/reset is included to compile the reset route; the DB was just reset, so it is harmless.
 * Any 5xx during warm-up fails fast with the offending request, instead of surfacing later as a flaky test.
 */
export default async function globalSetup() {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3100";
  const hit = async (method: string, path: string, body?: string) => {
    const res = await fetch(base + path, {
      method,
      ...(body === undefined ? {} : { body, headers: { "content-type": "application/json" } }),
    });
    if (res.status >= 500) {
      throw new Error(`e2e warm-up: ${method} ${path} returned ${res.status}. The dev server is unhealthy; check its output.`);
    }
  };

  for (const path of [
    "/", "/?halal=1", "/r/hk_golden_dragon", "/cart", "/checkout", "/orders", "/orders?tab=history", "/orders/warmup",
    "/api/orders", "/api/orders/warmup", "/api/ops/riders",
    "/ops", "/ops/orders/warmup", "/api/ops/orders", "/api/simulation", "/api/fake-provider/items",
  ]) {
    await hit("GET", path); // /ops/orders/warmup may 404; that still compiles the route
  }
  const api: [string, string][] = [
    ["POST", "/api/session"],
    ["POST", "/api/cart/items"],
    ["PATCH", "/api/cart/items/warmup"],
    ["PUT", "/api/cart/promo"],
    ["POST", "/api/cart/reorder"],
    ["POST", "/api/orders/warmup/cancel"],
    ["POST", "/api/orders/warmup/retry-payment"],
    ["POST", "/api/orders/warmup/abandon"],
    ["POST", "/api/fake-provider/intents/warmup"],
    ["POST", "/api/ops/orders/warmup/actions"],
    ["POST", "/api/webhooks/payments/fake"], // unsigned empty body: logged as REJECTED, no order effect
    ["POST", "/api/ops/reset"],
  ];
  for (const [method, path] of api) await hit(method, path, "{}");
}
