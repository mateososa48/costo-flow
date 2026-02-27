import OpenAI from "openai";
import { config } from "@/config";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return _client;
}

export type LLMExtraction = {
  invoiceDate: string;           // yyyy-mm-dd
  supplier: string;
  invoiceNumber: string | null;
  importe: number;               // net amount before IVA
  iva: number;
  total: number;
  extractionConfidence: number;  // 0-1
};

const SYSTEM_PROMPT = `You are an expert invoice parser for a Mexican restaurant group.
Extract the following fields from the invoice and return STRICT JSON.
Currency is MXN unless otherwise stated.
If you are uncertain about a value, provide your best estimate and set extractionConfidence lower.
Date format must be YYYY-MM-DD.
Fields:
- invoiceDate: date on the invoice (YYYY-MM-DD)
- supplier: full legal name of the supplier/vendor
- invoiceNumber: invoice/folio number (null if not present)
- importe: net subtotal amount (before IVA/tax)
- iva: IVA / tax amount
- total: total amount including IVA
- extractionConfidence: your confidence in the extraction, 0.0 to 1.0

Do NOT invent values. If importe is not explicitly shown, calculate as total - iva.
Return only the JSON object, no extra text.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    invoiceDate: { type: "string", description: "Invoice date in YYYY-MM-DD format" },
    supplier: { type: "string", description: "Supplier/vendor full name" },
    invoiceNumber: { type: ["string", "null"], description: "Invoice or folio number" },
    importe: { type: "number", description: "Net subtotal before IVA" },
    iva: { type: "number", description: "IVA / tax amount" },
    total: { type: "number", description: "Total including IVA" },
    extractionConfidence: { type: "number", description: "Confidence 0.0-1.0" },
  },
  required: ["invoiceDate", "supplier", "invoiceNumber", "importe", "iva", "total", "extractionConfidence"],
  additionalProperties: false,
};

/**
 * Extract invoice data from a base64-encoded image (vision path).
 */
export async function extractInvoiceFromImage(
  base64: string,
  mimeType: string
): Promise<LLMExtraction> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: config.openai.model,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "invoice_extraction",
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
          },
          { type: "text", text: "Extract all invoice fields from this image." },
        ],
      },
    ],
    max_tokens: 512,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as LLMExtraction;
}

/**
 * Extract invoice data from raw text (text-based PDF path).
 */
export async function extractInvoiceFromText(text: string): Promise<LLMExtraction> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: config.openai.model,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "invoice_extraction",
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Extract all invoice fields from the following invoice text:\n\n${text}`,
      },
    ],
    max_tokens: 512,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as LLMExtraction;
}
