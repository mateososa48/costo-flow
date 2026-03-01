/**
 * pdf.ts — Renders the first page of a PDF to a base64 PNG for LLM vision.
 * Always uses image rendering (never text extraction) for maximum accuracy.
 * Uses pdfjs-dist with Node.js runtime (not Edge).
 */

export async function pdfToImage(buffer: Buffer): Promise<{ base64: string; mimeType: "image/png" }> {
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

  const { createCanvas } = await import("@napi-rs/canvas");

  const viewport = page.getViewport({ scale: 3.0 }); // 3x scale for high-quality OCR
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d");

  await page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;

  const base64 = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
  return { base64, mimeType: "image/png" };
}
