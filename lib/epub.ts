// lib/epub.ts
import EPub from "epub";
import { chromium } from "playwright-core";
import fs from "fs/promises"; // Using promise-based FS
import path from "path";
import os from "os";
import crypto from "crypto";
import chromiumBinary from "@sparticuz/chromium";

export async function epubToPdf(epubBuffer: ArrayBuffer): Promise<Buffer> {
  // 1. Create a unique temporary file path
  const tempId = crypto.randomUUID();
  const tmpPath = path.join(os.tmpdir(), `${tempId}.epub`);

  await fs.writeFile(tmpPath, Buffer.from(epubBuffer));

  let browser;
  try {
    const epub = new EPub(tmpPath);

    await new Promise<void>((resolve, reject) => {
      epub.on("end", resolve);
      epub.on("error", reject);
      epub.parse();
    });

    let html = `<html><head><meta charset="utf-8"/><style>
    body { font-family: serif; padding: 2rem; line-height: 1.6; }
    img { max-width: 100%; height: auto; }
    .page-break { page-break-after: always; }
    </style></head><body>`;

    for (const item of epub.flow) {
      const chapter = await new Promise<string>((resolve, reject) => {
        epub.getChapter(item.id, (err, text) =>
          err ? reject(err) : resolve(text)
        );
      });
      html += `<section>${chapter}</section><div class="page-break"></div>`;
    }
    html += "</body></html>";

    const executablePath = await chromiumBinary.executablePath();
    browser = await chromium.launch({
      args: chromiumBinary.args,
      executablePath: executablePath,
      headless: true,
    });

    // create a new page instance
    const context = await browser.newContext();
    const page = await context.newPage();
    // 2. Resource Management: Launch Browser
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "1cm", bottom: "1cm", left: "1cm", right: "1cm" },
    });

    return pdf;
  } finally {
    // 3. Cleanup: Close browser and delete temp file regardless of success/fail
    if (browser) {
      await browser.close();
    }
    try {
      await fs.unlink(tmpPath);
    } catch (e) {
      console.error("Failed to delete temp file", e);
    }
  }
}
