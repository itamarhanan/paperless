import { test, expect } from "@playwright/test";

test("a first visit gets the front page, and an empty library keeps it", async ({ page }) => {
  await page.goto("/");
  const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(jsonLd["@type"]).toBe("WebApplication");

  await page.getByRole("link", { name: "Open your library" }).first().click();
  await expect(page).toHaveURL(/\/library$/);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Open your library" }).first()).toBeVisible();
});

test("the public pages link to each other in reading order", async ({ page }) => {
  await page.goto("/about");
  await page.getByRole("navigation", { name: "Next page" }).getByRole("link").click();
  await expect(page).toHaveURL(/\/how-it-works$/);

  await page.getByRole("navigation", { name: "Next page" }).getByRole("link").click();
  await expect(page).toHaveURL(/\/privacy$/);

  await page.getByRole("navigation", { name: "Next page" }).getByRole("link").click();
  await expect(page).toHaveURL(/\/library$/);
});

test("the header shows where you are", async ({ page }) => {
  await page.goto("/how-it-works");
  const current = page.getByRole("navigation", { name: "Site" }).locator('[aria-current="page"]');
  await expect(current).toHaveText("How it works");
});

test("the library links to the public pages", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("link", { name: "What Paperless does" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/library");
  await page.locator("footer").getByRole("link", { name: "How it works" }).click();
  await expect(page).toHaveURL(/\/how-it-works$/);
});

test("public pages have a description and a canonical address; the reader and book pages aren’t indexed", async ({ page }) => {
  for (const path of ["/about", "/how-it-works", "/privacy", "/discover"]) {
    await page.goto(path);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{60,}/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${path}$`));
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  }
  for (const path of ["/library", "/reader", "/book"]) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  }
});

test("sitemap.xml and robots.txt list the right pages", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  for (const path of ["/about", "/how-it-works", "/discover", "/privacy"]) {
    expect(xml).toMatch(new RegExp(`<loc>[^<]*${path}</loc>`));
  }
  expect(xml).not.toContain("/reader");
  expect(xml).not.toContain("/book");

  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  const text = await robots.text();
  expect(text).toContain("Disallow: /api/");
  expect(text).toMatch(/Sitemap: \S+\/sitemap\.xml/);
});
