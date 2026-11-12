import { test, expect } from "@playwright/test";

// Auto mode and step delay are global: restore them (and the data) after the test.
test.afterEach(async ({ request }) => {
  await request.post("/api/ops/reset");
});

test("auto mode completes an order unattended", async ({ context }) => {
  const customer = await context.newPage();
  const ops = await context.newPage();

  // Auto mode only ticks while /ops is open, so turn it on there and keep that page open.
  await ops.goto("/ops");
  await ops.getByTestId("delay-input").fill("1");
  await ops.getByTestId("auto-toggle").click();
  await expect(ops.getByTestId("auto-toggle")).toBeChecked();

  await customer.request.post("/api/session", { data: { userId: "u_mei", country: "HK" } });
  const add = await customer.request.post("/api/cart/items", {
    data: { menuItemId: "hk_gd_har_gow", qty: 1, optionIds: [], replaceCart: true },
  });
  expect(add.ok()).toBeTruthy();
  await customer.goto("/checkout");
  await customer.getByTestId("pay-button").click();
  await customer.getByTestId("fake-pending").click();

  await expect(customer.getByTestId("order-status")).toHaveText("Delivered", { timeout: 20_000 });

  // Timeline: first event is PENDING_PAYMENT; everything after is AUTO, except the PROVIDER payment event.
  const events = customer.getByTestId("timeline-event");
  await expect(events.first()).toContainText("PENDING PAYMENT");
  const texts = await events.allInnerTexts();
  const after = texts.slice(1);
  expect(after.filter((t) => !t.includes("PROVIDER")).length).toBeGreaterThanOrEqual(4);
  expect(after.filter((t) => t.includes("PROVIDER"))).toHaveLength(1);
  expect(after.filter((t) => t.includes("PROVIDER"))[0]).toContain("PLACED");
  for (const t of after.filter((t) => !t.includes("PROVIDER"))) expect(t).toContain("AUTO");
});
