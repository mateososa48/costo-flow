import OpenAI from "openai";
import { config } from "@/config";
import dropdownOptions from "../../data/dropdown_options.json";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return _client;
}

// Normalized units returned by the LLM
export const UNIT_NORMALIZED_VALUES = ["kg", "g", "l", "ml", "pz", "caja", "docena", "bolsa", "metro", "lata", "botella", "galon", "costal", "sobre", "rollo", "otros"] as const;
export type UnitNormalized = typeof UNIT_NORMALIZED_VALUES[number];

export type LLMLineItem = {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitNormalized: UnitNormalized;
  unitPrice: number | null;
  total: number;
  category: string | null;
};

export type LLMExtraction = {
  invoiceDate: string;           // yyyy-mm-dd
  supplier: string;
  invoiceNumber: string | null;
  importe: number;               // net amount before IVA
  iva: number;
  total: number;
  concepto: string | null;       // best-guess from valid list, or null
  cuentaPnl: string | null;      // best-guess from valid list, or null
  lineItems: LLMLineItem[];     // individual products/services
  extractionConfidence: number;  // 0-1
};

const conceptoList = (dropdownOptions.concepto as string[]).join(" | ");
const cuentaPnlList = (dropdownOptions.cuentaPnl as string[]).join(" | ");

const SYSTEM_PROMPT = `You are an expert invoice parser for a Mexican restaurant group.
Extract the following fields from the invoice and return STRICT JSON.
Currency is MXN unless otherwise stated. IMPORTANT - Number formatting: Mexican invoices use a period as the DECIMAL separator, not a thousands separator. "230.000" means $230.00, NOT $230,000. Always treat digits after a period as cents. Sanity-check: does the total make sense for the items on this invoice?
If you are uncertain about a value, provide your best estimate and set extractionConfidence lower.
Mexican invoices use DD/MM/YYYY date format. Always return invoiceDate as YYYY-MM-DD.
Fields:
- invoiceDate: date on the invoice, converted to YYYY-MM-DD
- supplier: full legal name of the supplier/vendor
- invoiceNumber: invoice/folio number — digits ONLY, strip any letters, dashes, slashes, or prefix characters (e.g. "FC-143439" → "143439", "A7381" → "7381", "FV-2-1180" → "21180"). Return null if no number is present.
- importe: net subtotal amount (before IVA/tax)
- iva: IVA / tax amount
- total: total amount including IVA
- concepto: pick the single best match from this list (null if none fit): ${conceptoList}
- cuentaPnl: pick the single best match from this list (null if none fit): ${cuentaPnlList}
- lineItems: extract every individual line item on the invoice. Each item should have:
  - description: product/service name as written on the invoice
  - quantity: number or null
  - unit: unit as written on the invoice (kg, pz, lt, caja, etc.) or null
  - unitNormalized: normalize unit to one of: kg, g, l, ml, pz, caja, docena, bolsa, metro, lata, botella, galon, costal, sobre, rollo, otros. Use "otros" if the unit doesn't match any of these.
  - unitPrice: unit price or null
  - total: line item total
  - category: pick the single best match from this list for THIS specific item (null if none fit): ${conceptoList}
  If no itemized breakdown is visible, return an empty array.
- extractionConfidence: your confidence in the extraction, 0.0 to 1.0

Do NOT invent values. Read only what is explicitly printed on the invoice.
- If IVA/tax is not shown on the invoice, set iva=0 and importe=total.
- If importe is not shown but IVA is, calculate importe as total - iva.
- Never assume or calculate IVA from a percentage if it is not explicitly printed.
Return only the JSON object, no extra text.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    invoiceDate: { type: "string", description: "Invoice date in YYYY-MM-DD format" },
    supplier: { type: "string", description: "Supplier/vendor full name" },
    invoiceNumber: { anyOf: [{ type: "string" }, { type: "null" }], description: "Invoice or folio number — digits only, no letters or special characters" },
    importe: { type: "number", description: "Net subtotal before IVA" },
    iva: { type: "number", description: "IVA / tax amount" },
    total: { type: "number", description: "Total including IVA" },
    concepto: { anyOf: [{ type: "string" }, { type: "null" }], description: "Best matching concepto from the valid list" },
    cuentaPnl: { anyOf: [{ type: "string" }, { type: "null" }], description: "Best matching cuentaPnl from the valid list" },
    lineItems: {
      type: "array",
      description: "Individual line items from the invoice",
      items: {
        type: "object",
        properties: {
          description: { type: "string", description: "Product or service name as written on invoice" },
          quantity: { anyOf: [{ type: "number" }, { type: "null" }], description: "Quantity" },
          unit: { anyOf: [{ type: "string" }, { type: "null" }], description: "Unit as written on invoice (kg, pz, lt, etc.)" },
          unitNormalized: { type: "string", enum: [...UNIT_NORMALIZED_VALUES], description: "Normalized unit" },
          unitPrice: { anyOf: [{ type: "number" }, { type: "null" }], description: "Price per unit" },
          total: { type: "number", description: "Line item total" },
          category: { anyOf: [{ type: "string" }, { type: "null" }], description: "Best matching concepto category for this specific item" },
        },
        required: ["description", "quantity", "unit", "unitNormalized", "unitPrice", "total", "category"],
        additionalProperties: false,
      },
    },
    extractionConfidence: { type: "number", description: "Confidence 0.0-1.0" },
  },
  required: ["invoiceDate", "supplier", "invoiceNumber", "importe", "iva", "total", "concepto", "cuentaPnl", "lineItems", "extractionConfidence"],
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

  const response = await client.beta.chat.completions.parse({
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
    max_completion_tokens: 8192,
  }, { signal: AbortSignal.timeout(45_000) });

  const message = response.choices[0]?.message;
  if (message?.refusal) throw new Error(`Model refused to extract: ${message.refusal}`);
  // .parse() puts structured result in message.parsed; fall back to content for older models
  const result = message?.parsed ?? (message?.content ? JSON.parse(message.content) : {});
  return result as LLMExtraction;
}

/**
 * Extract invoice data from raw text (text-based PDF path).
 */
export async function extractInvoiceFromText(text: string): Promise<LLMExtraction> {
  const client = getClient();

  const response = await client.beta.chat.completions.parse({
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
    max_completion_tokens: 8192,
  }, { signal: AbortSignal.timeout(45_000) });

  const message = response.choices[0]?.message;
  if (message?.refusal) throw new Error(`Model refused to extract: ${message.refusal}`);
  const result = message?.parsed ?? (message?.content ? JSON.parse(message.content) : {});
  return result as LLMExtraction;
}
