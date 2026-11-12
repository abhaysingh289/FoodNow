import { test, expect } from "@playwright/test";

test("sideways rows can be scrolled with a mouse via the arrow buttons", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.goto("/");

  const row = page.getByTestId("group-row-near");
  await expect(row.getByTestId("scroll-left")).toHaveCount(0); // at the start
  await row.getByTestId("scroll-right").click();
  await expect(row.getByTestId("scroll-left")).toBeVisible();
  const scroller = row.locator("> div").first();
  expect(await scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);

  const chips = page.getByTestId("filter-row");
  await chips.getByTestId("scroll-right").click();
  await expect(chips.getByTestId("scroll-left")).toBeVisible();
});
