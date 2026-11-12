/**
 * `next dev` compiles each route on first request, and a compile landing mid-navigation makes
 * clicks and refreshes slow or flaky. Hit every route the customer flow uses once up front.
 * API calls use empty bodies, so they compile the route and fail validation without side effects.
 */
export default async function globalSetup() {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3100";
  for (const path of ["/", "/?halal=1", "/r/hk_golden_dragon", "/cart"]) {
    await fetch(base + path);
  }
  const api: [string, string][] = [
    ["POST", "/api/session"],
    ["POST", "/api/cart/items"],
    ["PATCH", "/api/cart/items/warmup"],
    ["PUT", "/api/cart/promo"],
  ];
  for (const [method, path] of api) {
    await fetch(base + path, { method, body: "{}", headers: { "content-type": "application/json" } });
  }
}
