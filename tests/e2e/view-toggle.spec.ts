import { test, expect } from "@playwright/test";

test("customer app: switch to the phone frame and back to the same page", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("view-mobile").click();
  await expect(page).toHaveURL(/\/device\?src=%2F$/);

  const frame = page.frameLocator('[data-testid="device-frame"]');
  await expect(frame.getByTestId("group-near")).toBeVisible();
  await expect(frame.getByTestId("view-mobile")).toHaveCount(0); // a phone does not show the switch
  const width = await page.getByTestId("device-frame").evaluate((f) => (f as HTMLIFrameElement).contentWindow!.innerWidth);
  expect(width).toBe(390);

  await frame.getByTestId("restaurant-card-hk_golden_dragon").click();
  await expect(frame.getByTestId("item-hk_gd_wonton")).toBeVisible();
  await page.getByTestId("view-desktop").click();
  await expect(page).toHaveURL(/\/r\/hk_golden_dragon$/);
  await expect(page.getByTestId("view-desktop")).toHaveAttribute("aria-pressed", "true");
});

test("ops and customer views are remembered separately", async ({ page }) => {
  await page.goto("/ops");
  await page.getByTestId("view-mobile").click();
  await expect(page).toHaveURL(/\/device\?src=%2Fops$/);
  await expect(page.frameLocator('[data-testid="device-frame"]').getByTestId("ops-column-PLACED")).toBeVisible();

  await page.goto("/"); // the customer app is still on desktop
  await expect(page.getByTestId("view-desktop")).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/ops"); // ops reopens in the phone frame
  await expect(page).toHaveURL(/\/device\?src=%2Fops$/);
  await expect(page.frameLocator('[data-testid="device-frame"]').getByTestId("ops-column-PLACED")).toBeVisible();
  await page.getByTestId("view-desktop").click();
  await expect(page).toHaveURL(/\/ops$/);
  await expect(page.getByTestId("ops-column-PLACED")).toBeVisible();
});

test("the phone frame only loads app pages", async ({ page }) => {
  await page.goto("/device?src=https%3A%2F%2Fexample.com");
  await expect(page.getByTestId("device-frame")).toHaveAttribute("src", "/");
});
