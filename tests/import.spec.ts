import { test, expect, makeEpub, makePdf } from "./fixtures";
import { addFile, openContents } from "./helpers";

test("a PDF reads as clean text, with its chapters in the contents", async ({ page, browser, ai }) => {
  // Print the test PDF in a separate page, so this one starts clean
  const printer = await browser.newPage();
  const pdf = await makePdf(printer);
  await printer.close();

  await page.goto("/");
  await expect(page.getByText("Your library is empty")).toBeVisible();
  await addFile(page, "the-reading-book.pdf", "application/pdf", pdf);

  const text = await page.locator(".reader-prose").innerText();
  expect(text).toContain("Paragraph 1.1");
  expect(text).not.toContain("ﬁ"); // ligatures become plain letters
  expect(text).not.toContain("Draft"); // the running head is gone
  await expect(page.locator(".reader-prose h1, .reader-prose h2").first()).toContainText("Chapter 1");

  const contents = await openContents(page);
  for (const n of [1, 2, 3, 4]) await expect(contents.getByText(`Chapter ${n}: On Reading`)).toBeVisible();
  await page.keyboard.press("Escape"); // closes the sheet on phones

  // The AI only relabels: a quote appears, the words stay the book's
  await expect(page.getByText(/by AI/)).toBeVisible({ timeout: 15_000 });
  expect(ai.enhance).toBeGreaterThan(0);
  await expect(page.locator(".reader-prose blockquote")).toHaveCount(1);
  const passages = await page.evaluate(() => [...(CSS.highlights.get("key-passage") ?? [])].map((r) => r.toString()));
  expect(passages).toEqual(["Paragraph 1.1"]); // the made-up passage was rejected

  await page.getByRole("button", { name: "Show original" }).click();
  await expect(page.locator(".reader-prose blockquote")).toHaveCount(0);
});

test("an EPUB keeps its chapters, italics and title", async ({ page, ai }) => {
  void ai;
  await page.goto("/");
  await addFile(page, "garden.epub", "application/epub+zip", makeEpub());

  await expect(page.locator(".reader-prose em").first()).toHaveText("italic words");
  const contents = await openContents(page);
  // "Roots" has no heading in its file; the book's own contents names it
  for (const title of ["Seeds", "Roots", "Leaves"]) await expect(contents.getByText(title, { exact: true })).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("link", { name: "The Test Garden", exact: true })).toBeVisible();
});

test("a scanned PDF explains why it can't be read", async ({ page, browser }) => {
  const printer = await browser.newPage();
  await printer.setContent(`<svg width="400" height="600"><rect width="400" height="600" fill="#ddd"/></svg>`);
  const scan = await printer.pdf({ format: "A5" });
  await printer.close();

  await page.goto("/");
  await page.locator('input[type=file][accept*="pdf"]').setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: scan });
  await expect(page.getByText(/scanned pages without text/)).toBeVisible({ timeout: 30_000 });
});
