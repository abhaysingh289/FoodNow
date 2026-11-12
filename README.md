# FoodNow

FoodNow is a small food-delivery marketplace (Foodpanda / Grab Food style) built to learn how the marketplace flow works and how such a system is engineered. You operate every role yourself: you are the **customer** in the customer app, and the **restaurant, rider and payment provider** through the `/ops` console. Two countries are supported (Hong Kong and Singapore), with a full order lifecycle, every failure path, asynchronous refunds, and an optional auto mode that plays the happy path for you.

## Stack

Next.js 15 (App Router) and TypeScript, Prisma 6 on SQLite, Tailwind CSS 4, Vitest (unit, flow and contract tests), Playwright (end-to-end). No auth and no external services.

## Setup

```bash
npm install
cp .env.example .env        # on Windows PowerShell: Copy-Item .env.example .env
npm run db:reset            # creates the SQLite schema and seeds demo data
npm run app                 # builds and starts the fast production server: http://localhost:3000
```

Use `npm run app` whenever you want to *use* the app. `npm run dev` (hot reload for editing code) is much slower: Next.js dev mode adds roughly 0.4–2 s to every request, which makes the ops console feel sluggish. After changing code, stop `npm run app` and run it again to rebuild.

`.env` holds `DATABASE_URL`, `PAYMENT_PROVIDER` (default `fake`), `FAKE_WEBHOOK_SECRET` and `APP_BASE_URL` (default `http://localhost:3000`). The fake provider delivers webhooks to `APP_BASE_URL`, so keep it matching the port you run on.

Never use `prisma db push --force-reset` or `prisma migrate reset`; `npm run db:reset` is the supported way to rebuild the dev database.

## Tests

```bash
npm test                          # Vitest: unit, flow and contract suites (slow, about 5 minutes)
npm run typecheck                 # tsc --noEmit
npx playwright install chromium   # once, before the first e2e run
npm run test:e2e                  # Playwright; starts its own dev server on port 3100 with its own e2e.db
```

The e2e suite covers browsing and cart building, the HK happy path driven from ops, decline then retry then cancel, the SG restaurant-reject refund, and an unattended auto-mode order.

## Two-tab walkthrough

Put two browser windows side by side: the customer app on the left (`http://localhost:3000`) and the ops console on the right (`http://localhost:3000/ops`).

1. **Left:** pick a demo user and country in the top bar (for example Mei Chan, HK). Browse the home page, open a restaurant, add an item (choose any required option), and open the cart.
2. **Left:** try a promo code (see below), then go to checkout and press **Pay**.
3. **Left:** the fake payment sheet appears. Choose **Approve**. The order page now says "Waiting for restaurant to confirm".
4. **Right:** the order appears in the **PLACED** column. Click **Accept**. The left tab shows an ETA within two seconds (both sides poll every 2 s).
5. **Right:** pick a rider in the order card, click **Assign rider**. The left tab shows the rider card.
6. **Right:** click **Picked up**, then **Delivered**. The left tab shows "Delivered" and the order moves to the **History** tab of `/orders`, where you can **Reorder**.
7. Open the order in ops (`/ops/orders/<id>`) to see the full timeline with actors, payment and refund attempts, and the webhook log.

To see failures, repeat the loop and use the controls below instead of the happy-path buttons.

## What the ops console can trigger

**Order actions** (shown on each card only when valid for the order's current status):

| Control | Effect |
|---|---|
| Accept / Reject | Restaurant accepts, or rejects (reason `RESTAURANT_REJECTED`, refund follows) |
| Assign rider / No rider | Assign an available rider of the order's country, or declare none found (`NO_RIDER`, refund follows) |
| Picked up / Delivered | Normal progression |
| Delivery failed | After a rider is assigned or the order is picked up (`DELIVERY_FAILED`, refund follows) |
| Retry refund | When a refund has failed |

**Failure paths** you can walk through:

- **Payment declined:** choose **Decline** on the fake sheet; the customer can retry payment or cancel (abandon).
- **Restaurant rejects:** Reject on a PLACED order, then succeed the refund.
- **No rider:** Accept, then No rider.
- **Delivery failed:** Accept, assign, pick up, then Delivery failed.
- **Customer cancels:** press Cancel on the customer order page while it is still PLACED.
- **Payment start failed:** if starting the payment errors, the tracking page shows a **Retry payment** button for the order stuck in "Processing payment…".
- **Refund fails:** Fail the pending refund in the provider panel, then use Retry refund.

**Payment provider panel** (the "provider's side" of the fake provider):

- **Succeed / Fail:** decide a pending payment (left pending via **Leave pending** on the fake sheet) or a pending refund.
- **Succeed x2:** the provider delivers the same webhook twice; the second is logged as a duplicate and changes nothing.
- **Bad signature:** delivers a webhook with an invalid signature; it is rejected and logged (linked to its order when the body names a known payment or refund). The order stays in "Processing payment…" until you use **Resend webhook**, which delivers it properly.
- **Resend webhook:** re-delivers a past event.

**Riders:** toggle each rider busy or available. **Simulation:** auto mode and step delay. **Data:** **Reset & reseed** wipes orders, payments, refunds, webhook logs, fake provider state and carts, and restores riders and settings.

### Auto mode

Auto mode runs only while /ops is open. The ops page calls `POST /api/simulation/tick` once per second while auto mode is on; there are no background timers on the server. Each tick advances orders whose latest event is older than the step delay by one happy-path step (pending payment succeeds, accept, assign the first available rider, pick up, deliver, succeed pending refunds, retry failed refunds). It never triggers a failure. Every auto action is recorded with actor `AUTO`.

## Demo data

**Users** (no passwords; switch from the top bar):

| User | Default country | Addresses |
|---|---|---|
| Mei Chan (`u_mei`) | HK | Central (HK), Orchard (SG) |
| Arjun Nair (`u_arjun`) | SG | Tampines (SG), Wan Chai (HK) |
| Sam Lee (`u_sam`) | HK | Mong Kok (HK), Bugis (SG) |

**Countries:**

| | HK | SG |
|---|---|---|
| Currency | HKD (`HK$`) | SGD (`S$`) |
| Tax | none | GST 9% |
| Delivery fee | HK$10 + HK$3/km, cap HK$35 | S$2 + S$0.60/km, cap S$7 |

**Promo codes:**

| Code | Country | Effect | Minimum spend |
|---|---|---|---|
| `WELCOME20` | HK | 20% off, up to HK$50 | HK$100 |
| `FREEDEL` | HK | Free delivery | HK$80 |
| `SAVE5` | SG | S$5 off | S$25 |
| `FREEDEL` | SG | Free delivery | S$15 |

A promo that stops qualifying after a cart edit is shown as not applied (with the reason), and checkout refuses it.

## Adding a real payment provider

Only the `payments` module knows a provider exists, so no changes are needed in `orders`, `cart`, `delivery`, `simulation` or ops actions.

1. Implement `StripeProvider` / `AirwallexProvider` (or similar) against the `PaymentProvider` interface in `src/modules/payments/provider.ts`, and register it in `src/modules/payments/registry.ts`.
2. Add a renderer for its `ClientAction` in checkout (the fake provider's is the fake payment sheet).
3. Point the provider's dashboard webhooks to `/api/webhooks/payments/<name>`.
4. Set `PAYMENT_PROVIDER=<name>` and the provider's keys in `.env` (the Prisma CLI reads only `.env`).
5. Run the shared provider contract test suite (under `tests/contract`) against the provider's test mode.

## GST display simplification

Real Singapore consumer pricing must be displayed GST-inclusive. The prototype deliberately shows GST (9%) as a separate line in SG carts and orders so the tax calculation is visible. This is an intentional simplification, not a bug. HK has no tax line.

## Architecture map

Routes under `src/app/api` are thin: they parse input, call one module function and map the result or error to HTTP. Business rules live in `src/modules`.

| Path | Owns |
|---|---|
| `src/modules/catalog` | Restaurants, menus, districts, search/filter/sort/grouping, distance |
| `src/modules/cart` | Cart contents, modifier validation, pricing and promos, reorder |
| `src/modules/orders` | Order creation (checkout), the state machine, the event log. Only `transition.ts` writes `Order.status` |
| `src/modules/payments` | Payment and refund records, webhook handling, the provider interface and registry. `fake/` is the fake provider and the only code that touches `FakeProvider*` tables |
| `src/modules/delivery` | Riders, assignment, ETA |
| `src/modules/simulation` | Auto-mode settings and the tick |
| `src/lib` | Prisma client, money, country config, errors, session cookies, HTTP helpers |
| `src/app/(customer)` | Customer screens |
| `src/app/ops` | Ops console screens |
| `prisma/` | Schema and JSON seed data |
| `tests/` | `unit`, `flows`, `contract`, `e2e` |

The full design is in `docs/superpowers/specs/2026-11-12-foodnow-design.md`.
