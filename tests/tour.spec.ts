import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { openContents } from "./helpers";

// A new reader: the tour hasn't been seen on this device
test.use({ tourSeen: false });

const tour = (page: Page) => page.getByRole("dialog", { name: /Reader tour/ });
const step = (page: Page, n: number, title: string) =>
  expect(tour(page)).toHaveAccessibleName(`Reader tour, step ${n} of 5 ${title}`);

async function openSample(page: Page) {
  await page.goto("/library");
  await page.getByRole("button", { name: "Try it with Meditations" }).click();
  await page.locator(".reader-prose").waitFor();
}

test.beforeEach(async ({ ai }) => {
  void ai;
});

test("the sample opens with the tour, and each step moves on when the reader does it", async ({ page, isMobile }) => {
  await openSample(page);
  await step(page, 1, "Reading in Paperless");
  await expect(tour(page)).toBeFocused();
  // Started once: a reload won't start it again
  await expect(page).not.toHaveURL(/tour=1/);

  await tour(page).getByRole("button", { name: "Next" }).click();
  await step(page, 2, "Contents");

  // Opening the contents: the sidebar on desktop moves on at once; the sheet on a
  // phone hides the card until it closes
  await openContents(page);
  if (isMobile) {
    await expect(tour(page)).toBeHidden();
    await page.getByRole("button", { name: "Close" }).click();
  }
  await step(page, 3, "Text size");

  await page.locator('[data-tour="appearance"]:visible').click();
  await expect(tour(page)).toBeHidden();
  await page.getByRole("button", { name: "Larger text" }).click();
  // Escape closes the panel first, without ending the tour
  if (isMobile) await page.getByRole("button", { name: "Close" }).click();
  else await page.keyboard.press("Escape");
  await step(page, 4, "Turning pages");

  await page.getByRole("button", { name: /^Next · page 2/ }).click();
  await step(page, 5, "Your own books");
  await expect(page.getByRole("button", { name: /^Page 2 of/ })).toBeVisible();

  await tour(page).getByRole("button", { name: "Done" }).click();
  await expect(tour(page)).toHaveCount(0);

  await page.reload();
  await page.locator(".reader-prose").waitFor();
  await expect(tour(page)).toHaveCount(0);
});

test("Next walks through every step, and the toolbars stay while it runs", async ({ page }) => {
  await openSample(page);
  const titles = ["Reading in Paperless", "Contents", "Text size", "Turning pages", "Your own books"];
  for (const [i, title] of titles.entries()) {
    await step(page, i + 1, title);
    await expect(page.locator('[data-tour="library"]')).toBeInViewport();
    if (i < titles.length - 1) await tour(page).getByRole("button", { name: "Next" }).click();
  }
  // The page wasn't turned for it
  await expect(page.getByRole("button", { name: /^Page 1 of/ })).toBeVisible();
  await tour(page).getByRole("button", { name: "Done" }).click();
  await expect(tour(page)).toHaveCount(0);
});

test("Skip ends the tour, and it doesn't come back after a reload", async ({ page }) => {
  await openSample(page);
  await step(page, 1, "Reading in Paperless");
  await tour(page).getByRole("button", { name: "Next" }).click();
  await tour(page).getByRole("button", { name: "Skip" }).click();
  await expect(tour(page)).toHaveCount(0);

  await page.reload();
  await page.locator(".reader-prose").waitFor();
  await expect(tour(page)).toHaveCount(0);
});

test("Escape ends the tour", async ({ page }) => {
  await openSample(page);
  await step(page, 1, "Reading in Paperless");
  await page.keyboard.press("Escape");
  await expect(tour(page)).toHaveCount(0);
  // Focus stays in the reader
  await expect(page.locator("#reader-text")).toBeFocused();
});

test("Show the tour in the More menu replays it", async ({ page }) => {
  await openSample(page);
  await tour(page).getByRole("button", { name: "Skip" }).click();
  await expect(tour(page)).toHaveCount(0);

  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Show the tour" }).click();
  await step(page, 1, "Reading in Paperless");
  await expect(tour(page)).toBeFocused();
});

test("a returning reader's sample opens without the tour", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("paperless:tour-seen", "1"));
  await openSample(page);
  await expect(page).not.toHaveURL(/tour=1/);
  await expect(tour(page)).toHaveCount(0);
});
