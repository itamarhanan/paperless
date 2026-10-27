import type { Page } from "@playwright/test";
import { test, expect, pageIndicator } from "./fixtures";

/** Pages of the first saved book that the AI has finished checking, read straight from IndexedDB. */
function checkedPages(page: Page) {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open("PaperlessDB");
        open.onsuccess = () => {
          const request = open.result.transaction("savedDocuments").objectStore("savedDocuments").getAll();
          request.onsuccess = () => {
            const pages: { isEnhanced?: boolean }[] = request.result[0]?.document.pages ?? [];
            open.result.close();
            resolve(pages.filter((p) => p.isEnhanced).length);
          };
        };
      })
  );
}

async function openDetailsFromReader(page: Page) {
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("menuitem", { name: "Book details" }).click();
  await page.waitForURL(/\/book\?id=.*from=reader/);
  await expect(page.getByRole("heading", { level: 1, name: "Meditations" })).toBeVisible();
}

test.beforeEach(async ({ page, ai }) => {
  void ai;
  await page.goto("/library");
  await page.getByRole("button", { name: "Try it with Meditations" }).click();
  await page.locator(".reader-prose").waitFor();
});

test("details open from the library and from the reader, and lead back", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("button", { name: "Options for Meditations" }).click();
  await page.getByRole("menuitem", { name: "Book details" }).click();
  await page.waitForURL(/\/book\?id=/);
  await expect(page.getByRole("heading", { level: 1, name: "Meditations" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Project Gutenberg #2680" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Start reading|Continue reading/ })).toBeVisible();

  await page.getByRole("link", { name: "Back to library" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  await page.getByRole("link", { name: "Meditations", exact: true }).click();
  await page.locator(".reader-prose").waitFor();
  await openDetailsFromReader(page);
  await page.getByRole("link", { name: "Back to reading" }).click();
  await page.locator(".reader-prose").waitFor();
  await expect(page).toHaveURL(/\/reader\?id=/);
});

test("a contents entry opens the reader on its page", async ({ page }) => {
  await openDetailsFromReader(page);
  const contents = page.getByRole("list", { name: "Contents" });
  await contents.getByRole("link", { name: /The Second Book/ }).click();

  await expect(pageIndicator(page)).toHaveText(/Page 2 of/);
  await expect(page.locator(".reader-prose")).toContainText("Begin the morning");
  // The page comes from the link once; afterwards the saved position takes over
  await expect(page).not.toHaveURL(/page=/);
  await page.reload();
  await expect(pageIndicator(page)).toHaveText(/Page 2 of/);
});

test("what the AI did is listed, and removing it can be undone", async ({ page }) => {
  // The reader checks the open page and the next one, then saves
  await expect.poll(() => checkedPages(page), { timeout: 15_000 }).toBe(2);
  await openDetailsFromReader(page);

  const checked = page.getByRole("listitem").filter({ hasText: "Pages checked" });
  await expect(checked).toContainText("2 of 2");
  await expect(page.getByRole("listitem").filter({ hasText: "Quotes set apart" })).toContainText("1");

  const passages = page.getByRole("list", { name: "Key passages" });
  await expect(passages.getByRole("link")).toHaveCount(2);
  // A passage the book doesn't contain was never kept
  await expect(passages).not.toContainText("A sentence the book never says.");
  await passages.getByRole("link", { name: /Begin the morning/ }).click();
  await expect(pageIndicator(page)).toHaveText(/Page 2 of/);

  await page.goBack();
  await expect(checked).toBeVisible();
  await page.getByRole("button", { name: "Remove AI changes" }).click();
  await expect(page.getByText("Removed AI changes")).toBeVisible();
  await expect(page.getByText("The AI hasn’t checked any pages yet.")).toBeVisible();
  await expect(passages).toHaveCount(0);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(checked).toContainText("2 of 2");
  await expect(passages.getByRole("link")).toHaveCount(2);
  await page.reload();
  await expect(checked).toContainText("2 of 2");
});
