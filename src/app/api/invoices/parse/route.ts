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

  const invoices: ExtractedInvoice[] = [];
  const errors: Array<{ filename: string; error: string }> = [];

  for (const file of files) {
    try {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        errors.push({ filename: file.name, error: `Unsupported file type: ${file.type}` });
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      let extraction;

      if (file.type === "application/pdf") {
        const pdfResult = await extractFromPdf(buffer);
        if (pdfResult.mode === "text") {
          extraction = await extractInvoiceFromText(pdfResult.text);
        } else {
          extraction = await extractInvoiceFromImage(pdfResult.base64, pdfResult.mimeType);
        }
      } else {
        const base64 = buffer.toString("base64");
        extraction = await extractInvoiceFromImage(base64, file.type);
      }

      // Look up supplier mapping
      const mapping = lookupSupplier(extraction.supplier);

      const invoice: ExtractedInvoice = {
        id: uuidv4(),
        restaurant,
        invoiceDate: extraction.invoiceDate,
        supplier: extraction.supplier,
        invoiceNumber: extraction.invoiceNumber ?? undefined,
        importe: extraction.importe,
        iva: extraction.iva,
        total: extraction.total,
        concepto: mapping?.concepto ?? "",
        cuentaPnl: mapping?.cuentaPnl ?? "",
        comments: "",
        extractionConfidence: extraction.extractionConfidence,
        extractionMethod: file.type === "application/pdf" ? "llm_text" : "llm_vision",
      };

      invoices.push(invoice);
    } catch (err) {
      console.error(`[parse] Error processing file "${file.name}":`, err);
      errors.push({
        filename: file.name,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const response: ParseApiResponse = { invoices };
  if (errors.length > 0) response.errors = errors;

  return NextResponse.json(response);
}
