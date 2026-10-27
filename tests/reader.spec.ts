import { test, expect, pageIndicator } from "./fixtures";

test.beforeEach(async ({ page, ai }) => {
  void ai;
  await page.goto("/library");
  await page.getByRole("button", { name: "Try it with Meditations" }).click();
  await page.locator(".reader-prose").waitFor();
});

test("pages turn and the position survives a reload", async ({ page }) => {
  await expect(pageIndicator(page)).toHaveText(/Page 1 of/);
  await page.getByRole("button", { name: /^Next/ }).click();
  await expect(pageIndicator(page)).toHaveText(/Page 2 of/);
  await expect(page.locator(".reader-prose")).toContainText("Begin the morning");
  await page.reload();
  await expect(pageIndicator(page)).toHaveText(/Page 2 of/);
});

test("search takes any characters", async ({ page }) => {
  await page.getByRole("button", { name: /^Search/ }).first().click();
  const search = page.getByRole("searchbox", { name: "Search in this document" });
  await search.fill("(.*[");
  await expect(page.getByText(/No matches for/)).toBeVisible();
  await search.fill("grandfather");
  await expect(page.getByText(/matches? on \d+ pages?/)).toBeVisible();
});

test("AI limits are explained instead of failing quietly", async ({ page }) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({ status: 429, json: { error: "You’ve reached this hour’s AI limit.", code: "rate_limited" } })
  );
  await page.getByRole("button", { name: "Ask about this page" }).first().click();
  await page.getByRole("button", { name: "Summarize this page" }).click();
  await expect(page.getByText("You’ve reached this hour’s AI limit.")).toBeVisible();
  await expect(page.locator("#chat-input")).toBeEnabled();
});

test("arrow keys turn pages on desktop", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard shortcuts are for desktop");
  await page.locator(".reader-prose p").first().click();
  await page.keyboard.press("ArrowRight");
  await expect(pageIndicator(page)).toHaveText(/Page 2 of/);
  await page.keyboard.press("ArrowLeft");
  await expect(pageIndicator(page)).toHaveText(/Page 1 of/);
});
