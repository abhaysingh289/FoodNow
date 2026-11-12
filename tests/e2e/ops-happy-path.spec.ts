import { test, expect } from "@playwright/test";

test("HK happy path driven from ops", async ({ context }) => {
  const customer = await context.newPage();
  const ops = await context.newPage();

  await customer.request.post("/api/session", { data: { userId: "u_mei", country: "HK" } });
  const add = await customer.request.post("/api/cart/items", {
    data: { menuItemId: "hk_gd_har_gow", qty: 2, optionIds: [], replaceCart: true },
  });
  expect(add.ok()).toBeTruthy();
  await customer.goto("/checkout");
  await customer.getByTestId("pay-button").click();
  await customer.getByTestId("fake-approve").click();
  await expect(customer.getByTestId("order-status")).toHaveText("Waiting for restaurant to confirm");
  const orderId = customer.url().split("/").pop()!;

  await ops.goto("/ops");
  const card = ops.getByTestId(`ops-order-${orderId}`);
  await expect(card).toBeVisible();
  await expect(ops.getByTestId("ops-column-PLACED").getByTestId(`ops-order-${orderId}`)).toBeVisible();
  await card.getByTestId("ops-action-ACCEPT").click();
  await expect(customer.getByTestId("order-eta")).toContainText("~33 min");

  await card.getByTestId("rider-picker").selectOption({ index: 1 });
  await card.getByTestId("ops-action-ASSIGN_RIDER").click();
  await expect(customer.getByTestId("rider-card")).toBeVisible();
  await card.getByTestId("ops-action-PICK_UP").click();
  await card.getByTestId("ops-action-DELIVER").click();
  await expect(customer.getByTestId("order-status")).toHaveText("Delivered");
  await expect(ops.getByTestId("ops-column-DONE").getByTestId(`ops-order-${orderId}`)).toBeVisible();

  await customer.goto("/orders");
  await customer.getByTestId("tab-history").click();
  await expect(customer.getByTestId(`order-row-${orderId}`)).toBeVisible();

  await ops.goto(`/ops/orders/${orderId}`);
  await expect(ops.getByTestId("timeline-event").first()).toBeVisible();
});

test("ops side panels: rider toggle, simulation settings, reset confirm", async ({ page }) => {
  await page.goto("/ops");
  const toggle = page.getByTestId(/^rider-toggle-/).first();
  await expect(toggle).toHaveText("Set busy");
  await toggle.click();
  await expect(toggle).toHaveText("Set available");
  await toggle.click();
  await expect(toggle).toHaveText("Set busy");

  const delay = page.getByTestId("delay-input");
  await expect(delay).toBeEnabled();
  await delay.fill("7");
  await page.reload();
  await expect(page.getByTestId("delay-input")).toHaveValue("7");
  await page.getByTestId("delay-input").fill("5");

  await page.getByTestId("auto-toggle").click();
  await page.reload();
  await expect(page.getByTestId("auto-toggle")).toBeChecked();
  await page.getByTestId("auto-toggle").click();
  await page.reload();
  await expect(page.getByTestId("auto-toggle")).not.toBeChecked();

  await page.getByTestId("reset-data").click();
  await expect(page.getByTestId("reset-dialog")).toContainText("wipes all orders, payments, carts and webhooks");
  await page.getByTestId("reset-confirm").click();
  await expect(page.getByTestId("reset-dialog")).toBeHidden({ timeout: 30_000 });
});
