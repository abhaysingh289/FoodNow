import { test, expect } from "@playwright/test";

test("checkout, decline, retry, approve, cancel → refund pending", async ({ page }) => {
  // page.request shares the browser context's cookies, so the session and cart seeded here are the page's.
  const session = await page.request.post("/api/session", { data: { userId: "u_mei", country: "HK" } });
  expect(session.ok()).toBeTruthy();
  const add = await page.request.post("/api/cart/items", {
    data: { menuItemId: "hk_gd_har_gow", qty: 2, optionIds: [], replaceCart: true },
  });
  expect(add.ok()).toBeTruthy();

  await page.goto("/checkout");
  await page.getByTestId("pay-button").click();
  await page.getByTestId("fake-decline").click();
  await expect(page.getByTestId("order-status")).toHaveText("Payment declined");
  await page.getByTestId("retry-payment").click();
  await page.getByTestId("fake-approve").click();
  await expect(page.getByTestId("order-status")).toHaveText("Waiting for restaurant to confirm");
  await page.getByTestId("cancel-order").click();
  await expect(page.getByTestId("refund-status")).toContainText("Refund in progress");
  // PENDING_PAYMENT, PAYMENT_FAILED, PENDING_PAYMENT, PLACED, REFUND_PENDING
  await expect(page.getByTestId("timeline-event")).toHaveCount(5);
});

test("delivered order: ETA, rider, history tab and reorder", async ({ page }) => {
  await page.request.post("/api/session", { data: { userId: "u_mei", country: "HK" } });
  await page.request.post("/api/cart/items", {
    data: { menuItemId: "hk_gd_har_gow", qty: 2, optionIds: [], replaceCart: true },
  });
  await page.goto("/checkout");
  await page.getByTestId("pay-button").click();
  await page.getByTestId("fake-approve").click();
  await expect(page.getByTestId("order-status")).toHaveText("Waiting for restaurant to confirm");
  const orderId = page.url().split("/").pop()!;
  const ops = (action: string, extra: object = {}) =>
    page.request.post(`/api/ops/orders/${orderId}/actions`, { data: { action, ...extra } });

  expect((await ops("ACCEPT")).ok()).toBeTruthy();
  await expect(page.getByTestId("order-status")).toHaveText("Restaurant is preparing your food");
  await expect(page.getByTestId("order-eta")).toContainText("Arriving in ~");

  const riders = (await (await page.request.get("/api/ops/riders?country=HK")).json()) as { id: string; name: string }[];
  expect((await ops("ASSIGN_RIDER", { riderId: riders[0].id })).ok()).toBeTruthy();
  await expect(page.getByTestId("rider-card")).toContainText(riders[0].name);
  await expect(page.getByTestId("order-status")).toContainText(riders[0].name);

  expect((await ops("PICK_UP")).ok()).toBeTruthy();
  await expect(page.getByTestId("order-status")).toHaveText("On the way");
  expect((await ops("DELIVER")).ok()).toBeTruthy();
  await expect(page.getByTestId("order-status")).toHaveText("Delivered");
  await expect(page.getByTestId("order-eta")).toHaveCount(0);

  await page.goto("/orders");
  await expect(page.getByTestId(`order-row-${orderId}`)).toHaveCount(0); // delivered orders live under History
  await page.getByTestId("tab-history").click();
  await expect(page).toHaveURL(/tab=history/);
  const row = page.getByTestId(`order-row-${orderId}`);
  await expect(row).toBeVisible();
  await row.getByTestId("reorder").click();
  await expect(page).toHaveURL(/\/cart/);
  await expect(page.getByTestId("price-subtotal")).toHaveText("HK$84.00");
});
