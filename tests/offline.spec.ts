import { test, expect } from "./fixtures";

// The service worker is registered in production builds only:
// CI=1 E2E_PORT=3203 pnpm test
test.skip(!process.env.CI, "the service worker runs in production builds only");

test("the library, a book and its details open offline after one visit", async ({ page, context, ai }) => {
  void ai;
  await page.goto("/library");
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.ready) && !!navigator.serviceWorker.controller);

  await page.getByRole("button", { name: "Try it with Meditations" }).click();
  await page.locator(".reader-prose").waitFor();
  const reader = page.url();
  const id = new URL(reader).searchParams.get("id")!;

  await context.setOffline(true);

  // A reload needs the page itself from the worker
  await page.reload();
  await expect(page.locator(".reader-prose")).toContainText("Of my grandfather Verus");
  await page.getByRole("button", { name: /^Next/ }).click();
  await expect(page.locator(".reader-prose")).toContainText("Begin the morning");

  await page.goto("/library");
  await expect(page.getByRole("button", { name: "Options for Meditations" })).toBeVisible();

  await page.goto(`/book?id=${encodeURIComponent(id)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Meditations" })).toBeVisible();

  // Opened with a tap in the library, a client-side navigation
  await page.goto("/library");
  await page.locator(`a[href^="/reader?id="]`).first().click();
  // It opens where reading stopped
  await expect(page.locator(".reader-prose")).toContainText("Begin the morning");
});

test("the API is never answered from the cache", async ({ page, context }) => {
  await page.goto("/library");
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.ready) && !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  const failed = await page.evaluate(() =>
    fetch("/api/discover/search?q=meditations").then(
      () => false,
      () => true
    )
  );
  expect(failed).toBe(true);
  const cached = await page.evaluate(async () => {
    const keys = await Promise.all((await caches.keys()).map(async (name) => (await caches.open(name)).keys()));
    return keys.flat().map((r) => new URL(r.url).pathname);
  });
  expect(cached).toContain("/");
  expect(cached.some((path) => path.startsWith("/_next/static/"))).toBe(true);
  expect(cached.some((path) => path.startsWith("/api/"))).toBe(false);
});
