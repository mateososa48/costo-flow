/**
 * pdf.ts — Extracts invoice data from a PDF buffer.
 * Strategy:
 *   - Digital PDFs with clean extractable text → return text (cheaper, faster)
 *   - Scanned / handwritten / garbled-text PDFs → render to high-res PNG for vision
 *
 * "Clean" text = at least 300 chars AND at least 8% of characters are spaces
 * (garbled pdfjs output concatenates words without spaces, so space ratio drops).
 */

type PdfResult =
  | { mode: "text"; text: string }
  | { mode: "image"; base64: string; mimeType: "image/png" };

const MIN_TEXT_LENGTH = 300;
const MIN_SPACE_RATIO = 0.08; // at least 8% spaces → real words, not garbled concat

function isCleanText(text: string): boolean {
  if (text.length < MIN_TEXT_LENGTH) return false;
  const spaces = (text.match(/ /g) ?? []).length;
  return spaces / text.length >= MIN_SPACE_RATIO;
}

export async function extractFromPdf(buffer: Buffer): Promise<PdfResult> {
  // Dynamic import so this is not bundled for Edge runtime
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // eval('require') bypasses webpack's static analysis so it doesn't try to
  // bundle the ESM worker file at build time — it resolves at runtime instead.
  // eslint-disable-next-line no-eval
  const workerPath: string = (eval("require") as NodeRequire).resolve(
    "pdfjs-dist/legacy/build/pdf.worker.mjs"
  );
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

  if (isCleanText(text)) {
    return { mode: "text", text };
  }

  // --- Fall back to image rendering (scanned / handwritten / garbled text) ---
  const { createCanvas } = await import("@napi-rs/canvas");

  const viewport = page.getViewport({ scale: 3.0 }); // 3x scale for high-quality OCR
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d");

  await page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;

  const base64 = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
  return { mode: "image", base64, mimeType: "image/png" };
}
