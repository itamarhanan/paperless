import { test, expect, pageIndicator, LONG_GUTENBERG_HTML } from "./fixtures";
import type { Page } from "@playwright/test";
import { openReaderWithFakeSpeech } from "./speech";

// Reading aloud needs a long book to jump through and background progress to
// observe, so this file serves the long sample instead of the two-page one.
test.use({ gutenbergBook: LONG_GUTENBERG_HTML });

/** The player for this device: the phone bar or the floating desktop pill. */
const player = (page: Page, mobile?: boolean) =>
  page.locator(`[data-listen-player="${mobile ? "phone" : "desktop"}"]`);

// Asking for the `ai` fixture installs the Gutenberg route mock; without it
// the fake-voice helper would hit the real network and flake under load.
test.beforeEach(async ({ ai }) => {
  void ai;
});

test("reads the page aloud and turns pages by itself", async ({ page, isMobile }) => {
  await openReaderWithFakeSpeech(page);
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await expect(player(page, isMobile)).toBeVisible();

  // The voice moves through the paragraphs; the reader follows it. Somewhere
  // past the first page — how far depends on the voice's pace, so the exact
  // page is not what matters, only that the reader left page 1 behind.
  await expect(pageIndicator(page)).not.toHaveText(/Page 1 of/, { timeout: 30_000 });

  // Stopping takes the player away again; the voice has turned at least a page
  await player(page, isMobile).getByRole("button", { name: "Stop listening" }).click();
  await expect(player(page, isMobile)).toBeHidden();
  await expect(pageIndicator(page)).not.toHaveText(/Page 1 of/);
});

test("finishes the book with a quiet end, not a dialog", async ({ page, isMobile }) => {
  await openReaderWithFakeSpeech(page);
  // Start on the last page, so the book's end is a page away, not a whole book away
  await pageIndicator(page).click();
  await page.locator("#jump-page").fill("108");
  await page.locator("#jump-page").press("Enter");
  await expect(pageIndicator(page)).toHaveText(/Page 108 of/);

  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await expect(
    player(page, isMobile).locator("p", { hasText: "The end of the book." })
  ).toBeVisible({ timeout: 30_000 });

  await player(page, isMobile).getByRole("button", { name: "Stop listening" }).click();
  await expect(player(page, isMobile)).toBeHidden();
});

test("keeps reading while you look around the library", async ({ page, isMobile }) => {
  await openReaderWithFakeSpeech(page);
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await expect(player(page, isMobile)).toBeVisible();

  await page.getByRole("link", { name: "Back to library" }).click();
  await page.waitForURL(/\/library/);

  // The now-playing chip takes over where the reader's player left off
  const chip = page.locator("[data-listen-mini]");
  await expect(chip).toBeVisible();
  await expect(chip.getByRole("link", { name: "Back to the book" })).toBeVisible();

  // The voice keeps turning pages with the reader out of sight
  const at = chip.getByText(/Page \d+ of \d+/);
  await expect(at).toBeVisible();
  const before = await at.textContent();
  // Poll instead of sleeping and reading once: the chip's page label is set by
  // the voice's own pace, so a direct snapshot races its next page turn.
  await expect.poll(async () => at.textContent(), { timeout: 15_000 }).not.toBe(before);

  // Coming back into the book picks up where the voice is
  await chip.getByRole("link", { name: "Back to the book" }).click();
  await page.locator(".reader-prose").waitFor();
  await expect(page.locator("[data-listen-mini]")).toHaveCount(0); // the reader's player takes over
  await expect(player(page, isMobile)).toBeVisible();
  await expect(pageIndicator(page)).not.toHaveText(/Page 1 of/);

  await player(page, isMobile).getByRole("button", { name: "Stop listening" }).click();
  await expect(player(page, isMobile)).toBeHidden();
});

test("pause keeps the place and play resumes", async ({ page, isMobile }) => {
  await openReaderWithFakeSpeech(page);
  if (isMobile) await page.getByRole("button", { name: "Listen", exact: true }).click();
  else await page.keyboard.press("l");
  await expect(player(page, isMobile)).toBeVisible();

  const pause = player(page, isMobile).getByRole("button", { name: "Pause", exact: true });
  await pause.click();
  await expect(player(page, isMobile).getByRole("button", { name: "Listen", exact: true })).toBeVisible();

  // Sentence skips work while paused and come back
  await player(page, isMobile).getByRole("button", { name: "Back one sentence" }).click();
  await player(page, isMobile).getByRole("button", { name: "Forward one sentence" }).click();
  await expect(player(page, isMobile)).toBeVisible();

  await player(page, isMobile).getByRole("button", { name: "Listen", exact: true }).click();
  await expect(player(page, isMobile).getByRole("button", { name: "Pause", exact: true })).toBeVisible();
});

test("a device without voices explains itself", async ({ page, isMobile }) => {
  await openReaderWithFakeSpeech(page, { noVoices: true });
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await expect(
    player(page, isMobile).locator("p", { hasText: "No speaking voices are installed on this device." })
  ).toBeVisible({ timeout: 10_000 });
});
