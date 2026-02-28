/**
 * pdf.ts — Converts PDF buffers to base64 images for LLM vision, or extracts text.
 * Uses pdfjs-dist with Node.js runtime (not Edge).
 */

type PdfExtractionResult =
  | { mode: "text"; text: string }
  | { mode: "image"; base64: string; mimeType: "image/png" };

const TEXT_MIN_LENGTH = 100; // If extracted text < this, fall back to image rendering

export async function extractFromPdf(buffer: Buffer): Promise<PdfExtractionResult> {
  // Dynamic import so this is not bundled for Edge runtime
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // In Node.js (Vercel), pdfjs-dist v4 requires an explicit worker path.
  // Setting workerSrc to "" causes "fake worker" to throw; use the actual file.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const workerPath: string = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;

  const data = new Uint8Array(buffer);
  const pdfDoc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
  const page = await pdfDoc.getPage(1);

  // --- Attempt text extraction first (cheaper) ---
  const textContent = await page.getTextContent();
  const text = textContent.items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ")
    .trim();

  if (text.length >= TEXT_MIN_LENGTH) {
    return { mode: "text", text };
  }

  // --- Fall back to image rendering (scanned / handwritten PDF) ---
  const { createCanvas } = await import("@napi-rs/canvas");

  const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better OCR quality
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d");

  await page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;

  const base64 = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
  return { mode: "image", base64, mimeType: "image/png" };
}
