import type { Page } from "@playwright/test";

/** Opens the contents list: a sheet on phones, the sidebar on desktop. */
export async function openContents(page: Page) {
  const sidebar = page.getByRole("button", { name: "Show sidebar" });
  if (await sidebar.isVisible()) await sidebar.click();
  else await page.getByRole("button", { name: "Contents", exact: true }).click();
  return page.getByRole("complementary", { name: "Contents and bookmarks" }).or(page.getByRole("dialog"));
}

/** Adds a file through the library's file picker. */
export async function addFile(page: Page, name: string, mimeType: string, buffer: Buffer) {
  await page.locator('input[type=file][accept*="pdf"]').setInputFiles({ name, mimeType, buffer });
  await page.waitForURL(/\/reader\?id=/, { timeout: 30_000 });
  await page.locator(".reader-prose").waitFor();
}
