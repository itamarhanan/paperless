import { readFile } from "node:fs/promises";
import { test, expect } from "./fixtures";

test("the sample book opens in one tap, without Gutenberg's licence pages", async ({ page, ai }) => {
  void ai;
  await page.goto("/library");
  await page.getByRole("button", { name: "Try it with Meditations" }).click();
  await page.waitForURL(/\/reader\?id=/);
  const prose = page.locator(".reader-prose");
  await expect(prose).toContainText("Of my grandfather Verus");
  await expect(prose).not.toContainText("Project Gutenberg");
});

test("the front page's Start with Meditations adds the book, and then / opens the library", async ({ page, ai }) => {
  void ai;
  await page.goto("/");
  await page.getByRole("link", { name: "Start with Meditations" }).first().click();
  await page.waitForURL(/\/reader\?id=/);
  await expect(page.locator(".reader-prose")).toContainText("Of my grandfather Verus");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Meditations", exact: true })).toBeVisible();

  // Asking for the sample again opens the copy already there
  await page.goto("/library?sample");
  await page.waitForURL(/\/reader\?id=/);
  await page.goto("/library");
  await expect(page.getByRole("link", { name: "Meditations", exact: true })).toHaveCount(1);
});

test("a backup restores the library", async ({ page, ai }) => {
  void ai;
  await page.goto("/library");
  await page.getByRole("button", { name: "Try it with Meditations" }).click();
  await page.waitForURL(/\/reader\?id=/);
  await page.goto("/library");

  await page.getByRole("button", { name: "Library options" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: "Back up library" }).click(),
  ]);
  const backup = await readFile((await download.path())!);

  await page.getByRole("button", { name: /^Options for/ }).click();
  await page.getByRole("menuitem", { name: "Remove" }).click();
  await expect(page.getByText("Your library is empty")).toBeVisible();

  await page.locator('input[type=file][accept*="json"]').setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: backup });
  await expect(page.getByText("Restored 1 book")).toBeVisible();
  await expect(page.getByRole("link", { name: "Meditations", exact: true })).toBeVisible();
});

test("a file that isn't a backup is refused", async ({ page }) => {
  await page.goto("/library");
  await page.locator('input[type=file][accept*="json"]').setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from('{"hello":1}') });
  await expect(page.getByText("This isn’t a Paperless backup file.")).toBeVisible();
});
