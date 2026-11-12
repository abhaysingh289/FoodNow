import { test, expect } from "@playwright/test";

// Specs share one database: always leave it seeded with auto mode off.
test.afterEach(async ({ request }) => {
  await request.post("/api/ops/reset");
});

test("SG restaurant reject → refunded", async ({ context }) => {
  const customer = await context.newPage();
  const ops = await context.newPage();

  await customer.request.post("/api/session", { data: { userId: "u_arjun", country: "SG" } });
  // sg_tl_laksa has a required Spice level group; opt_laksa_mild is its Mild option.
  const add = await customer.request.post("/api/cart/items", {
    data: { menuItemId: "sg_tl_laksa", qty: 1, optionIds: ["opt_laksa_mild"], replaceCart: true },
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
  await card.getByTestId("ops-action-REJECT").click();
  await expect(customer.getByTestId("refund-status")).toContainText("Refund in progress");

  // The refund is decided on the provider's side: succeed it from the provider panel.
  const refundItem = ops.getByTestId(/^provider-item-/).filter({ hasText: /refund/i });
  await expect(refundItem).toHaveCount(1);
  await refundItem.getByTestId("provider-succeed").click();

  await expect(customer.getByTestId("refund-status")).toContainText("Refunded S$", { timeout: 15_000 });
  await customer.goto("/orders");
  await expect(customer.getByTestId(`order-row-${orderId}`)).toHaveCount(0);
  await customer.getByTestId("tab-history").click();
  await expect(customer.getByTestId(`order-row-${orderId}`)).toBeVisible();
});
