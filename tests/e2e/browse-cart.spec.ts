import { test, expect } from "@playwright/test";

test("browse HK and build a cart", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("group-near")).toBeVisible();
  await page.getByTestId("filter-halal").click(); // URL search params drive filters
  await page.getByTestId("filter-halal").click();
  await page.getByTestId("restaurant-card-hk_golden_dragon").click();
  await page.getByTestId("item-hk_gd_wonton").click();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("item-sheet")).toContainText("Choose 1"); // required group not chosen
  await page.getByTestId("option-opt_wonton_large").click();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-badge")).toHaveText("1");
  await page.goto("/cart");
  await expect(page.getByTestId("price-subtotal")).toHaveText("HK$70.00");
  await page.getByTestId("promo-input").fill("WELCOME20");
  await page.getByTestId("promo-apply").click();
  await expect(page.getByTestId("promo-error")).toHaveText("Minimum spend is HK$100.00");
  await page.getByTestId("qty-inc").click();
  await expect(page.getByTestId("price-discount")).toHaveText("-HK$28.00");
  await expect(page.getByTestId("price-tax")).toHaveCount(0); // HK: no GST line
  await page.getByTestId("country-SG").click();
  await page.goto("/");
  await expect(page.getByTestId("restaurant-card-sg_tampines_laksa")).toBeVisible();
  await expect(page.getByTestId("restaurant-card-hk_golden_dragon")).toHaveCount(0);
});
