# FoodNow — Design Spec

**Date:** 2026-11-12
**Status:** Draft for review
**Type:** Learning prototype (not a production product)

---

## 1. Purpose and success criteria

FoodNow is a lightweight food-delivery marketplace (Foodpanda / Grab Food style) built to learn **both** how the marketplace flow works and how such a system is engineered.

The owner operates every role personally: as the **customer** in the customer app, and as the **restaurant, rider and payment provider** through an **ops console**.

**Success means:**

1. Every journey below can be completed end-to-end in a browser on a local machine:
   - browse → cart → pay → deliver → history
   - each failure path → refund
2. Every order state change is visible, explainable, and recorded in a timeline.
3. The fake payment provider can later be replaced by a real provider's test mode (Stripe, Airwallex, Adyen) **without changing order, cart or ops logic**.
4. The code is readable as a learning reference: business rules live in isolated modules, not in UI code.

## 2. Decisions summary

| Area | Decision |
|---|---|
| Platform | Responsive web app (mobile-first customer UI; desktop ops console) |
| Stack | Next.js (App Router) + TypeScript, Prisma ORM, SQLite, Tailwind CSS, Vitest, Playwright |
| Architecture | Single Next.js app with isolated domain modules (Approach A) |
| Users | No auth — switch between seeded demo users |
| Countries | HK (HKD, no tax) and SG (SGD, 9% GST) |
| Location | Seeded districts + lat/lng; distance drives delivery fee and ETA; no live map |
| Catalogue | ~8 restaurants per country, 8–12 items each, simple modifiers |
| Cart | Single restaurant; server-side, one active cart per demo user; promo codes |
| Restaurant / rider | Operated manually via ops console; optional **auto mode** for the happy path |
| Time | Manual progression; ETA computed and displayed, not counted down |
| Payments | Provider-neutral `PaymentProvider` interface; `FakeProvider` first |
| Refunds | Asynchronous via webhook; full refunds only |
| Failures supported | Payment declined, restaurant rejects, no rider, delivery failed, customer cancels |

## 3. Scope

### In scope
- Country switch (HK / SG), demo-user switch, delivery address/district selection.
- Restaurant discovery: search, filters, sort, grouped rows.
- Restaurant menu with categories and modifiers.
- Cart with pricing breakdown and promo codes.
- Checkout and payment through the provider adapter.
- Order tracking with status, ETA, rider details, and timeline.
- Order history (active + past) with reorder.
- Ops console: order actions, provider event controls, rider availability, auto mode, data reset.
- Refund flow for every post-payment failure.

### Out of scope
- Real authentication / login, OTP.
- Real maps, live rider GPS tracking, route calculation.
- Push / email / SMS notifications.
- Ratings and reviews (ratings are static seed data).
- Scheduled orders, group orders, multi-restaurant carts.
- Partial refunds, tips, loyalty, wallets.
- Restaurant menu management UI (menus change only via seed data).
- Deployment; the app runs locally only.

## 4. Architecture

### 4.1 Structure

```
foodnow/
├─ prisma/
│  ├─ schema.prisma
│  └─ seed/                 # JSON seed files + seed script
│     ├─ countries.json
│     ├─ districts.json
│     ├─ restaurants.hk.json
│     ├─ restaurants.sg.json
│     ├─ users.json
│     ├─ riders.json
│     └─ promos.json
├─ src/
│  ├─ app/
│  │  ├─ (customer)/        # customer screens
│  │  ├─ ops/               # ops console screens
│  │  └─ api/               # thin route handlers
│  ├─ modules/
│  │  ├─ catalog/
│  │  ├─ cart/
│  │  ├─ orders/
│  │  ├─ payments/
│  │  │  ├─ provider.ts     # PaymentProvider interface + ProviderEvent types
│  │  │  ├─ registry.ts     # picks provider from PAYMENT_PROVIDER env var
│  │  │  └─ fake/           # FakeProvider + its own state + fake payment sheet API
│  │  ├─ delivery/
│  │  └─ simulation/
│  └─ lib/                  # db client, money, country config, errors
└─ tests/
   ├─ unit/
   ├─ flows/
   ├─ contract/
   └─ e2e/
```

### 4.2 Module responsibilities

| Module | Owns | Exposes (examples) | Depends on |
|---|---|---|---|
| `catalog` | Restaurants, menus, districts, search/filter/sort/grouping, distance | `listRestaurants(query)`, `getRestaurant(id)`, `getHomeGroups(ctx)` | `lib` |
| `cart` | Cart contents, modifier validation, pricing, promo validation | `getCart(userId)`, `addItem(...)`, `updateQty(...)`, `applyPromo(...)`, `priceCart(...)` | `catalog`, `lib` |
| `orders` | Order creation, **state machine**, event log, failure reasons | `placeOrder(userId, addressId)`, `transition(orderId, to, actor, note?)`, `allowedActions(order)`, `getOrder(id)`, `listOrders(userId)` | `cart`, `payments`, `delivery`, `lib` |
| `payments` | Payment and refund records, webhook handling, provider adapter | `startPayment(orderId)`, `retryPayment(orderId)`, `startRefund(orderId)`, `handleWebhook(provider, rawBody, headers)` | `orders` (via `transition` only), `lib` |
| `delivery` | Riders, assignment, ETA | `assignRider(orderId, riderId)`, `releaseRider(orderId)`, `computeEta(order, stage)` | `catalog`, `lib` |
| `simulation` | Auto-mode settings, tick | `getSettings()`, `updateSettings(...)`, `tick()` | `orders`, `delivery`, `payments` |

### 4.3 Architectural rules

1. **Routes are thin.** An API route parses input, calls one module function, and maps the result or error to HTTP. No business rules in `app/`.
2. **Only `orders.transition` changes `Order.status`.** All other modules request transitions through it.
3. **`payments` is the only module that knows a provider exists.** Other modules only see `Payment` / `Refund` records and normalised `ProviderEvent`s.
4. **Simulation reuses ops actions.** Auto mode calls the same functions as ops buttons; there is no separate code path.
5. **Country behaviour is data, not code branches.** Currency, tax rate, fee rules and districts come from country config.
6. **Money is integer minor units (cents)** throughout. Rounding is half-up, applied once per computed line (tax, percentage discount).
7. **`FakeProvider` state is "external".** Its tables (§5.6) represent the provider's own system; app modules must never read them directly — only through the adapter interface and webhooks.

## 5. Data model

Lists such as `cuisines`, `tags`, `selectedOptionIds`, and snapshots are stored as JSON columns (SQLite has no native arrays).

### 5.1 Catalog (seeded, read-only at runtime except `Rider.isAvailable`)

| Entity | Fields |
|---|---|
| `District` | id, country (`HK`\|`SG`), name, lat, lng |
| `Restaurant` | id, country, districtId, name, description, cuisines (json), tags (json: `halal`, `vegetarian`), rating (1.0–5.0), priceLevel (1–3), prepMinutes, lat, lng, imageUrl, isOpen |
| `MenuCategory` | id, restaurantId, name, sort |
| `MenuItem` | id, categoryId, name, description, priceCents, imageUrl, isAvailable |
| `ModifierGroup` | id, menuItemId, name, required, minSelect, maxSelect |
| `ModifierOption` | id, groupId, name, priceDeltaCents |
| `Promo` | code, country, type (`PERCENT`\|`FLAT`\|`FREE_DELIVERY`), value, minSubtotalCents, maxDiscountCents? |

### 5.2 Users (seeded)

| Entity | Fields |
|---|---|
| `User` | id, name, phone, defaultCountry |
| `Address` | id, userId, country, districtId, label, line1, lat, lng |

Every demo user has **at least one address in each country**, so switching country never leaves the user without an address.

### 5.3 Cart

| Entity | Fields |
|---|---|
| `Cart` | id, userId (unique), restaurantId?, promoCode?, updatedAt |
| `CartItem` | id, cartId, menuItemId, qty, selectedOptionIds (json), note? |

### 5.4 Orders

| Entity | Fields |
|---|---|
| `Order` | id, userId, restaurantId, country, currency, addressSnapshot (json), status, failureReason?, subtotalCents, discountCents, deliveryFeeCents, taxCents, totalCents, promoCode?, distanceKm, etaMinutes?, createdAt, updatedAt |
| `OrderItem` | id, orderId, menuItemId, nameSnapshot, unitPriceCents (base + modifiers), qty, optionsSnapshot (json: names + deltas), note? |
| `OrderEvent` | id, orderId, fromStatus?, toStatus, actor (`CUSTOMER`\|`OPS`\|`AUTO`\|`PROVIDER`\|`SYSTEM`), note?, createdAt |

`failureReason` ∈ `RESTAURANT_REJECTED`, `CUSTOMER_CANCELLED`, `NO_RIDER`, `DELIVERY_FAILED`, `PAYMENT_ABANDONED`.

### 5.5 Payments

| Entity | Fields |
|---|---|
| `Payment` | id, orderId, provider, providerRef (unique), amountCents, currency, status (`PENDING`\|`SUCCEEDED`\|`FAILED`), failureReason?, idempotencyKey, createdAt |
| `Refund` | id, paymentId, provider, refundRef? (unique), amountCents, status (`PENDING`\|`SUCCEEDED`\|`FAILED`), reason, failureReason?, idempotencyKey, createdAt |
| `WebhookLog` | id, provider, eventId (unique per provider), eventType, payload (json), signatureValid, result (`PROCESSED`\|`DUPLICATE`\|`REJECTED`\|`UNMATCHED`\|`MISMATCH`), receivedAt |

- An order has 0–n `Payment`s (one per attempt) and at most one **succeeded** payment.
- A succeeded payment has 0–n `Refund` attempts; at most one may succeed. All attempts for the same order share one `idempotencyKey` so a retry can never double-refund.

### 5.6 Fake provider (the provider's side — app code must not read these)

| Entity | Fields |
|---|---|
| `FakeProviderIntent` | ref, amountCents, currency, status (`REQUIRES_ACTION`\|`PENDING`\|`SUCCEEDED`\|`FAILED`), idempotencyKey (unique) |
| `FakeProviderRefund` | ref, intentRef, amountCents, status (`PENDING`\|`SUCCEEDED`\|`FAILED`), idempotencyKey (unique) |

### 5.7 Delivery and simulation

| Entity | Fields |
|---|---|
| `Rider` | id, country, name, vehicle (`MOTORBIKE`\|`BICYCLE`\|`CAR`), isAvailable |
| `Delivery` | id, orderId (unique), riderId?, assignedAt?, pickedUpAt?, deliveredAt?, failedAt? |
| `SimulationSettings` | id (singleton), autoMode (bool), stepDelaySeconds (default 5) |

## 6. Country configuration

| | HK | SG |
|---|---|---|
| Currency | HKD (display `HK$`) | SGD (display `S$`) |
| Tax | None | GST 9% |
| Delivery fee | HK$10 base + HK$3/km, cap HK$35 | S$2 base + S$0.60/km, cap S$7 |
| Districts (seed) | Central, Wan Chai, Causeway Bay, Tsim Sha Tsui, Mong Kok, Sha Tin | Orchard, Raffles Place, Bugis, Tampines, Jurong East, Woodlands |

> **Simplification:** real SG consumer pricing must be displayed GST-inclusive. The prototype shows GST as a separate line so the tax calculation is visible. This is intentional and documented, not a bug.

## 7. Pricing rules (`cart.priceCart`)

1. `unitPrice` = item `priceCents` + Σ selected option `priceDeltaCents`.
2. `subtotal` = Σ `unitPrice × qty`.
3. `discount`:
   - `PERCENT`: `round(subtotal × value / 100)`, capped at `maxDiscountCents` if set.
   - `FLAT`: `min(value, subtotal)`.
   - `FREE_DELIVERY`: `0` on subtotal; sets delivery fee to `0`.
   - Promo requires matching country and `subtotal ≥ minSubtotalCents`; otherwise `PromoInvalid` with a specific message.
4. `distanceKm` = haversine(restaurant, delivery address), rounded to 0.1 km.
5. `deliveryFee` = `min(base + perKm × distanceKm, cap)` (rounded), or `0` with free-delivery promo.
6. `tax` = `round((subtotal − discount) × taxRate)`; HK `taxRate = 0`.
7. `total` = `subtotal − discount + deliveryFee + tax`.

Seed promos:

| Code | Country | Type | Rule |
|---|---|---|---|
| `WELCOME20` | HK | PERCENT 20 | min HK$100, max HK$50 off |
| `FREEDEL` | HK | FREE_DELIVERY | min HK$80 |
| `SAVE5` | SG | FLAT S$5 | min S$25 |
| `FREEDEL` | SG | FREE_DELIVERY | min S$15 |

(Promo uniqueness is `(code, country)`.)

## 8. Catalogue and discovery

### 8.1 Seed data
- ~8 restaurants per country, spread over the 6 districts, mixed cuisines (e.g. HK: Cantonese, dim sum, Japanese, burgers, Thai, Indian, vegetarian café, dessert; SG: hawker/local, Chinese, Malay, Indian, Japanese, Western, Korean, vegetarian).
- At least one halal and one vegetarian restaurant per country; at least one restaurant per country with `isOpen = false`.
- 8–12 items per restaurant across 2–4 categories; at least 3 items per restaurant with modifiers (e.g. *Size* required single-select; *Spice level* required single-select; *Extras* optional multi-select max 3).
- At least one `isAvailable = false` item per country to exercise the unavailable path.
- Images: static placeholder images bundled locally (no external image dependency).
- Restaurants have no delivery radius limit; every restaurant in the selected country is deliverable.

### 8.2 Filters, sort, groupings
- **Search:** case-insensitive match on restaurant name, cuisine, and item names.
- **Filters (combinable):** cuisine (multi), rating ≥ 4.0, price level (multi), ETA ≤ 30 min, halal, vegetarian, has promo (restaurant tagged with a promo badge), open now.
- **Sort:** relevance (default: open first, then rating × proximity score), distance, rating, fastest ETA.
- **Home groupings:** *Near you* (5 closest open), *Top rated* (rating ≥ 4.5), *Fast delivery* (ETA ≤ 25 min), *Deals* (promo badge), then one row per cuisine present. Closed restaurants appear greyed out and cannot be ordered from.
- Displayed restaurant ETA (pre-order) = `prepMinutes + travelMinutes + 5` using the selected address.

## 9. Cart rules
- One active cart per demo user; persists across page reloads and user switches.
- Cart is bound to one restaurant. Adding an item from another restaurant prompts: *"Start a new cart? Your cart from {X} will be cleared."*
- Same item + identical options + identical note merges into one line (qty adds).
- Required modifier groups must be satisfied before adding; `minSelect`/`maxSelect` enforced client- and server-side.
- Switching country keeps the cart, but checkout is blocked with `CountryMismatch` if the cart's restaurant is in another country.
- Qty range 1–20 per line; setting 0 removes the line.

## 10. Order state machine

### 10.1 States

| Status | Meaning | Customer message |
|---|---|---|
| `PENDING_PAYMENT` | Order created, awaiting provider result | "Processing payment…" |
| `PAYMENT_FAILED` | Latest payment attempt failed | "Payment declined" + Retry / Cancel |
| `PLACED` | Paid, awaiting restaurant | "Waiting for restaurant to confirm" + Cancel |
| `ACCEPTED` | Restaurant preparing | "Restaurant is preparing your food" + ETA |
| `RIDER_ASSIGNED` | Rider heading to restaurant | "{Rider} ({vehicle}) is heading to the restaurant" + ETA |
| `PICKED_UP` | Rider on the way | "On the way" + ETA |
| `DELIVERED` | Terminal success | "Delivered" |
| `CANCELLED` | Terminal, no money captured | "Order cancelled" |
| `REFUND_PENDING` | Failure after payment, refund in progress | "Order cancelled: {reason}. Refund in progress" |
| `REFUNDED` | Terminal, money returned | "Order cancelled: {reason}. Refunded {amount}" |
| `REFUND_FAILED` | Refund attempt failed, ops to retry | "Order cancelled: {reason}. Refund delayed — we're on it" |

### 10.2 Transition table (exhaustive — anything not listed is rejected with `InvalidTransition`)

| From | To | Trigger / actor | Side effects |
|---|---|---|---|
| — | `PENDING_PAYMENT` | Checkout (`CUSTOMER`) | Re-price cart, snapshot items & address, create Order + first Payment, clear cart |
| `PENDING_PAYMENT` | `PLACED` | `payment.succeeded` webhook (`PROVIDER`) | Payment → SUCCEEDED |
| `PENDING_PAYMENT` | `PAYMENT_FAILED` | `payment.failed` webhook (`PROVIDER`) | Payment → FAILED |
| `PAYMENT_FAILED` | `PENDING_PAYMENT` | Retry payment (`CUSTOMER`) | New Payment attempt |
| `PAYMENT_FAILED` | `CANCELLED` | Abandon (`CUSTOMER`) | `failureReason = PAYMENT_ABANDONED` |
| `PLACED` | `ACCEPTED` | Accept (`OPS`/`AUTO`) | Compute ETA |
| `PLACED` | `REFUND_PENDING` | Reject (`OPS`) | `failureReason = RESTAURANT_REJECTED`; start refund |
| `PLACED` | `REFUND_PENDING` | Cancel (`CUSTOMER`) | `failureReason = CUSTOMER_CANCELLED`; start refund |
| `ACCEPTED` | `RIDER_ASSIGNED` | Assign rider (`OPS`/`AUTO`) | Rider → unavailable; Delivery.assignedAt; recompute ETA |
| `ACCEPTED` | `REFUND_PENDING` | No rider (`OPS`) | `failureReason = NO_RIDER`; start refund |
| `RIDER_ASSIGNED` | `PICKED_UP` | Picked up (`OPS`/`AUTO`) | Delivery.pickedUpAt; recompute ETA (travel only) |
| `RIDER_ASSIGNED` | `REFUND_PENDING` | Delivery failed (`OPS`) | `failureReason = DELIVERY_FAILED`; release rider; start refund |
| `PICKED_UP` | `DELIVERED` | Delivered (`OPS`/`AUTO`) | Delivery.deliveredAt; release rider |
| `PICKED_UP` | `REFUND_PENDING` | Delivery failed (`OPS`) | `failureReason = DELIVERY_FAILED`; release rider; start refund |
| `REFUND_PENDING` | `REFUNDED` | `refund.succeeded` webhook (`PROVIDER`) | Refund → SUCCEEDED |
| `REFUND_PENDING` | `REFUND_FAILED` | `refund.failed` webhook (`PROVIDER`) or provider call error (`SYSTEM`) | Refund → FAILED |
| `REFUND_FAILED` | `REFUND_PENDING` | Retry refund (`OPS`/`AUTO`) | New Refund attempt, same idempotency key |

### 10.3 Transition mechanics
- `transition(orderId, to, actor, note?)`:
  1. Loads order, checks `(from, to, actor)` against the table.
  2. In **one DB transaction**: conditional update `WHERE id = ? AND status = from` (guards against races), inserts `OrderEvent`, applies DB side effects.
  3. If the conditional update affects 0 rows → `ConcurrentModification` (HTTP 409).
  4. External side effects (calling the provider's `createPayment` / `refund`) run **after** commit; a provider error on refund transitions to `REFUND_FAILED` with actor `SYSTEM`.
- `allowedActions(order, actor)` is derived from the same table and drives which buttons the customer UI and ops console render.

### 10.4 ETA
- Constants: rider speed 20 km/h, buffer 5 min, rider-to-restaurant 5 min.
- At `ACCEPTED`: `prepMinutes + 5 (rider to restaurant) + travelMinutes + 5 buffer`.
- At `RIDER_ASSIGNED`: same formula, unchanged (rider assignment confirms the estimate).
- At `PICKED_UP`: `travelMinutes + 5 buffer`.
- `travelMinutes = ceil(distanceKm / 20 × 60)`.
- Displayed as "Arriving in ~N min" with the clock time it was computed; it does not count down.

## 11. Payments and refunds

### 11.1 Provider interface

```ts
interface PaymentProvider {
  name: string;
  createPayment(input: {
    orderId: string; amountCents: number; currency: "HKD" | "SGD"; idempotencyKey: string;
  }): Promise<{ providerRef: string; clientAction: ClientAction }>;

  refund(input: {
    providerRef: string; amountCents: number; reason: string; idempotencyKey: string;
  }): Promise<{ refundRef: string }>;

  verifyWebhook(rawBody: string, headers: Headers): boolean;
  parseWebhook(rawBody: string): ProviderEvent;
}

type ClientAction =
  | { type: "fake_sheet"; providerRef: string }
  | { type: "redirect"; url: string }
  | { type: "sdk"; sdk: string; params: Record<string, string> };  // e.g. Stripe Elements / Airwallex drop-in

type ProviderEvent =
  | { eventId: string; type: "payment.succeeded" | "payment.failed";
      providerRef: string; amountCents: number; reason?: string }
  | { eventId: string; type: "refund.succeeded" | "refund.failed";
      refundRef: string; amountCents: number; reason?: string };
```

- Provider selected by `PAYMENT_PROVIDER` env var (default `fake`) via `payments/registry.ts`.
- `refund()` only *requests* a refund; the outcome always arrives by webhook.

### 11.2 Fake provider behaviour
- `createPayment` creates a `FakeProviderIntent` (`REQUIRES_ACTION`) and returns `{ type: "fake_sheet" }`.
- **Fake payment sheet** (rendered in checkout) shows amount + currency and three buttons, which call the fake provider's own API (`/api/fake-provider/intents/[ref]`):
  - **Approve** → intent `SUCCEEDED`, emits `payment.succeeded`.
  - **Decline** → intent `FAILED`, emits `payment.failed` (reason "card_declined").
  - **Leave pending** → intent `PENDING`; decided later from the ops provider panel.
- `refund` creates a `FakeProviderRefund` (`PENDING`); decided from the ops provider panel (or by auto mode).
- Webhooks are delivered as real HTTP `POST`s to the app's own `/api/webhooks/payments/fake`, with header `x-fake-signature: HMAC-SHA256(rawBody, FAKE_WEBHOOK_SECRET)` and a unique `eventId`.
- Same `idempotencyKey` on `createPayment` / `refund` returns the existing intent/refund rather than creating a new one.

### 11.3 Webhook handling (`/api/webhooks/payments/[provider]`)

| Case | Response | Effect |
|---|---|---|
| Signature invalid | 400 | Logged `REJECTED`; nothing else |
| `eventId` already processed | 200 | Logged `DUPLICATE`; no change |
| Unknown `providerRef` / `refundRef` | 200 | Logged `UNMATCHED` |
| Amount ≠ Payment/Refund amount | 200 | Logged `MISMATCH`; order unchanged; flagged in ops order detail |
| Valid | 200 | Logged `PROCESSED`; Payment/Refund updated; `orders.transition` called |
| Valid `payment.succeeded`, but order no longer in `PENDING_PAYMENT` | 200 | Payment recorded as SUCCEEDED, then immediately refunded (actor `SYSTEM`) so no money is held for an order that cannot proceed; flagged in ops order detail |

Payment attempts are final once SUCCEEDED or FAILED. An order can only be abandoned from `PAYMENT_FAILED`, when no attempt is still pending, so a pending payment can't land on an abandoned order in normal use. The row above is the safety net.

Raw body is read before parsing JSON (required for signature verification with real providers).

### 11.4 Swapping in a real provider later
1. Implement `StripeProvider` / `AirwallexProvider` against `PaymentProvider`.
2. Add a renderer for its `ClientAction` in checkout.
3. Point the provider's dashboard webhooks to `/api/webhooks/payments/<name>`.
4. Set `PAYMENT_PROVIDER=<name>` and provider keys in `.env.local`.
5. Run the provider contract test suite (§15) against the provider's test mode.

No changes to `orders`, `cart`, `delivery`, `simulation`, or ops actions.

## 12. Screens

### 12.1 Customer app (mobile-first; centred max-width column on desktop)

| Route | Content |
|---|---|
| Top bar (global) | Country switch HK/SG · demo-user switch · address picker (user's addresses in current country) · cart badge |
| `/` Home | Search, filter chips, sort, grouped rows (§8.2), full list. Card: image, name, cuisines, rating, ETA, fee, distance, promo badge, closed state |
| `/r/[id]` Restaurant | Header (rating, distance, ETA, fee, open/closed), category tabs, items (unavailable greyed out), item sheet with modifiers/qty/note, cross-restaurant prompt |
| `/cart` | Lines with options, qty ±, remove, promo input with feedback, price breakdown, "Go to checkout" |
| `/checkout` | Address confirmation, summary, Pay → provider `ClientAction` (fake sheet) |
| `/orders/[id]` Tracking | Status progress bar, message, ETA, rider card, timeline, Cancel (`PLACED` only), Retry / Cancel (`PAYMENT_FAILED`), refund status. Polls every 2 s |
| `/orders` | Tabs **Active** / **History**; each row: restaurant, date, total, status badge; History rows have **Reorder** (rebuilds cart with currently available items, notes any skipped) |

### 12.2 Ops console (`/ops`, desktop)

| Panel | Content |
|---|---|
| Orders board | Columns by status (active statuses + recent terminal); cards show only `allowedActions` for the ops actor: Accept, Reject, Assign rider (rider picker of available riders in the order's country), No rider, Picked up, Delivered, Delivery failed, Retry refund. Polls every 2 s |
| Order detail | Timeline with actors, payment attempts, refund attempts, webhook log rows for this order, mismatch flags |
| Provider panel | Pending fake intents and refunds with **Succeed**, **Fail**, **Deliver twice**, **Deliver with bad signature** |
| Riders | Riders per country with availability toggle (busy riders shown with their current order) |
| Simulation | Auto mode toggle, step delay (1–60 s) |
| Data | **Reset & reseed** (wipes orders, payments, refunds, webhook logs, fake provider state, carts; restores riders and settings), with confirm dialog |

## 13. Simulation (auto mode)
- Settings stored in `SimulationSettings`.
- **Tick model:** while auto mode is on, the ops console calls `POST /api/simulation/tick` every second. `tick()` finds orders whose latest `OrderEvent` is older than `stepDelaySeconds` and advances them **one step along the happy path only**:
  - Fake intents `PENDING`/`REQUIRES_ACTION` → succeed.
  - `PLACED` → `ACCEPTED`.
  - `ACCEPTED` → `RIDER_ASSIGNED` (first available rider in country; if none, waits).
  - `RIDER_ASSIGNED` → `PICKED_UP` → `DELIVERED`.
  - Fake refunds `PENDING` → succeed; `REFUND_FAILED` → retry refund.
- Rationale for tick-on-request: avoids background timers in the Next.js dev server; auto mode runs whenever the ops console is open (documented in the README).
- Auto mode never triggers failures and never acts on an order that is in a failure state awaiting manual action other than refund retry.
- All auto actions are recorded with `actor = AUTO`.

## 14. Error handling
- Domain errors (in `lib/errors.ts`): `InvalidTransition`, `ConcurrentModification`, `CartConflict`, `CountryMismatch`, `ItemUnavailable`, `ModifierSelectionInvalid`, `PromoInvalid`, `RestaurantClosed`, `PaymentAmountMismatch`, `NotFound`.
- API response shape for all errors: `{ "error": { "code": "PROMO_INVALID", "message": "Minimum spend is HK$100" } }` with 400 / 404 / 409 / 422 as appropriate.
- UI: field-level messages for form errors (promo, modifiers); toast for action errors; 409 on ops board triggers a refresh with "Order already moved".
- Checkout re-prices server-side and fails with `ItemUnavailable`, `RestaurantClosed`, `PromoInvalid`, or `CountryMismatch` instead of trusting client totals.
- Unexpected errors: 500 with generic message; full error logged server-side.

## 15. Testing

| Layer | Tool | Coverage |
|---|---|---|
| Unit | Vitest | Pricing (modifiers, each promo type, min spend, cap, GST rounding, fee cap, free delivery); haversine + ETA; filters/sort/groupings; **state machine: every allowed transition succeeds and every non-listed (from, to, actor) is rejected** |
| Flow | Vitest + temporary SQLite DB, `FakeProvider` | Happy path; decline → retry → success; decline → abandon; reject → refund; no rider → refund; delivery failed after pickup → refund; cancel in `PLACED` → refund; cancel blocked after `ACCEPTED`; refund failed → retry → refunded; duplicate webhook ignored; bad signature rejected; amount mismatch flagged; concurrent transition → 409; country mismatch blocks checkout |
| Contract | Vitest | Shared suite every `PaymentProvider` must pass (create, idempotent create, webhook verify/parse, refund, idempotent refund). Runs against `FakeProvider` now; real provider test mode later |
| E2E | Playwright (two pages: customer + ops) | HK happy path to history; SG restaurant reject → refunded; auto mode completes an order unattended |

## 16. Running locally
- `npm install`, `npm run db:reset` (migrate + seed), `npm run dev`.
- `.env.local`: `DATABASE_URL="file:./dev.db"`, `PAYMENT_PROVIDER=fake`, `FAKE_WEBHOOK_SECRET=<generated>`, `APP_BASE_URL=http://localhost:3000`.
- `.env.example` committed with placeholders; `.env.local` git-ignored.
- `npm test` (unit + flow + contract), `npm run test:e2e` (Playwright).

## 17. Open items
None at time of writing. Future candidates (not in this spec): real provider adapter, map view, partial refunds, real auth.
