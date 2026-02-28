export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { extractFromPdf } from "@/lib/pdf";
import { extractInvoiceFromImage, extractInvoiceFromText } from "@/lib/openai";
import { lookupSupplier } from "@/lib/supplier-mapping";
import { getSession } from "@/lib/session";
import type { ExtractedInvoice, Restaurant, ParseApiResponse } from "@/types";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth check
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const restaurant = formData.get("restaurant") as Restaurant | null;
  if (!restaurant) {
    return NextResponse.json({ error: "Missing restaurant field" }, { status: 400 });
  }

  const files = formData.getAll("files") as File[];
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  async function processFile(file: File): Promise<ExtractedInvoice> {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(`Unsupported file type: ${file.type}`);
    }

    let imageBuffer = Buffer.from(await file.arrayBuffer());
    let extraction;

    if (file.type === "application/pdf") {
      const pdfResult = await extractFromPdf(imageBuffer);
      if (pdfResult.mode === "text") {
        extraction = await extractInvoiceFromText(pdfResult.text);
      } else {
        extraction = await extractInvoiceFromImage(pdfResult.base64, pdfResult.mimeType);
      }
    } else {
      // Server-side compression: resize any image > 1.5 MB to max 1600px JPEG.
      // Handles HEIC and images that weren't compressed client-side.
      const SIZE_LIMIT = 1.5 * 1024 * 1024;
      if (imageBuffer.length > SIZE_LIMIT) {
        try {
          const { createCanvas, loadImage } = await import("@napi-rs/canvas");
          const img = await loadImage(imageBuffer);
          const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
          const canvas = createCanvas(
            Math.round(img.width * scale),
            Math.round(img.height * scale)
          );
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          imageBuffer = Buffer.from(canvas.toBuffer("image/jpeg", 85));
        } catch {
          // If server-side compression fails, proceed with the original buffer
        }
      }
      const base64 = imageBuffer.toString("base64");
      extraction = await extractInvoiceFromImage(base64, "image/jpeg");
    }

    // Validate extraction — model may return empty object for unreadable images
    if (!extraction.supplier || !extraction.invoiceDate || extraction.total === undefined) {
      throw new Error(`DEBUG: supplier="${extraction.supplier}" date="${extraction.invoiceDate}" total=${extraction.total}`);
    }

    // Look up supplier mapping
    const mapping = lookupSupplier(extraction.supplier);

    return {
      id: uuidv4(),
      restaurant: restaurant as Restaurant,
      invoiceDate: extraction.invoiceDate,
      supplier: extraction.supplier,
      invoiceNumber: extraction.invoiceNumber ?? undefined,
      importe: extraction.importe,
      iva: extraction.iva,
      total: extraction.total,
      concepto: mapping?.concepto ?? extraction.concepto ?? "",
      cuentaPnl: mapping?.cuentaPnl ?? extraction.cuentaPnl ?? "",
      comments: "",
      extractionConfidence: extraction.extractionConfidence,
      extractionMethod: file.type === "application/pdf" ? "llm_text" : "llm_vision",
    };
  }

  // Process all files in parallel — total time ≈ slowest single file instead of sum
  const results = await Promise.allSettled(files.map((f) => processFile(f)));

  const invoices: ExtractedInvoice[] = [];
  const errors: Array<{ filename: string; error: string }> = [];

  for (const [i, result] of results.entries()) {
    if (result.status === "fulfilled") {
      invoices.push(result.value);
    } else {
      const err = result.reason;
      console.error(`[parse] Error processing file "${files[i].name}":`, err);
      errors.push({
        filename: files[i].name,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const response: ParseApiResponse = { invoices };
  if (errors.length > 0) response.errors = errors;

  return NextResponse.json(response);
}
