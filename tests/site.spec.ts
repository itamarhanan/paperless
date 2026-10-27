import { test, expect } from "@playwright/test";

test("About says what Paperless is and leads into the app", async ({ page }) => {
  await page.goto("/about");
  await expect(page).toHaveTitle("Paperless: read PDF and EPUB books as clean pages");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Read PDF and EPUB books as clean pages");
  for (const heading of ["Why I built it", "What it does", "Who it’s for", "The AI labels and never writes"]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await expect(page.getByRole("img", { name: /Paperless on a desktop/ })).toBeVisible();

  const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(jsonLd["@type"]).toBe("WebApplication");
  expect(jsonLd.name).toBe("Paperless");

  await page.getByRole("main").getByRole("link", { name: "Open Paperless" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
});

test("the public pages link to each other in reading order", async ({ page }) => {
  await page.goto("/about");
  await page.getByRole("navigation", { name: "Next page" }).getByRole("link").click();
  await expect(page).toHaveURL(/\/how-it-works$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How Paperless reads a book");
  for (const heading of ["From a PDF to pages", "What the AI may do", "How answers are checked", "Show original"]) {
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }

  await page.getByRole("navigation", { name: "Next page" }).getByRole("link").click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy");

  await page.getByRole("navigation", { name: "Next page" }).getByRole("link").click();
  await expect(page).toHaveURL(/\/$/);
});

test("the header shows where you are", async ({ page }) => {
  await page.goto("/how-it-works");
  const current = page.getByRole("navigation", { name: "Site" }).locator('[aria-current="page"]');
  await expect(current).toHaveText("How it works");
});

test("the library links to the public pages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "What Paperless does" }).click();
  await expect(page).toHaveURL(/\/about$/);

  await page.goto("/");
  await page.locator("footer").getByRole("link", { name: "How it works" }).click();
  await expect(page).toHaveURL(/\/how-it-works$/);
});

test("public pages have a description and a canonical address; the reader isn’t indexed", async ({ page }) => {
  for (const path of ["/about", "/how-it-works", "/privacy", "/discover"]) {
    await page.goto(path);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{60,}/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${path}$`));
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  }
  await page.goto("/reader");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("sitemap.xml and robots.txt list the right pages", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  for (const path of ["/about", "/how-it-works", "/discover", "/privacy"]) {
    expect(xml).toMatch(new RegExp(`<loc>[^<]*${path}</loc>`));
  }
  expect(xml).not.toContain("/reader");

  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  const text = await robots.text();
  expect(text).toContain("Disallow: /api/");
  expect(text).toMatch(/Sitemap: \S+\/sitemap\.xml/);
});
