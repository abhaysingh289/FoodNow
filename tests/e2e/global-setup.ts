/**
 * `next dev` compiles each route on first request, and a compile landing mid-navigation makes
 * clicks and refreshes slow or flaky. Hit every route the customer flow uses once up front.
 * API calls use empty bodies or an unknown order id, so they compile the route and fail without side effects.
 * (POST /api/orders is left out on purpose: it would place a real order for the default session.)
 */
export default async function globalSetup() {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3100";
  for (const path of ["/", "/?halal=1", "/r/hk_golden_dragon", "/cart", "/checkout", "/orders", "/orders?tab=history", "/orders/warmup", "/api/orders", "/api/orders/warmup", "/api/ops/riders"]) {
    await fetch(base + path);
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
  ];
  for (const [method, path] of api) {
    await fetch(base + path, { method, body: "{}", headers: { "content-type": "application/json" } });
  }
}
