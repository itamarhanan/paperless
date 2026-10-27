let pdfjsLib: any = null;

export async function loadPdfJs() {
  // Return cached instance if already loaded
  if (pdfjsLib) {
    return pdfjsLib;
  }

  // Ensure we're in the browser
  if (typeof window === "undefined") {
    throw new Error("PDF.js can only be loaded in the browser");
  }

  // Dynamically import pdfjs-dist only in the browser
  const pdfjs = await import("pdfjs-dist");

  // Configure the worker
  // Served from /public so reading works offline (copied from pdfjs-dist/build)
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  // Cache the library
  pdfjsLib = pdfjs;

  return pdfjs;
}
