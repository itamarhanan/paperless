let pdfjsLib: typeof import("pdfjs-dist") | null = null;

export async function loadPdfJs() {
  if (pdfjsLib) {
    return pdfjsLib;
  }

  if (typeof window === "undefined") {
    throw new Error("PDF.js can only be loaded in the browser");
  }

  const pdfjs = await import("pdfjs-dist");

  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  pdfjsLib = pdfjs;

  return pdfjs;
}
