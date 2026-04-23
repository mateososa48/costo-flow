// Restaurant is now a dynamic string slug (loaded from the DB per tenant).
// The old hardcoded union type is replaced so the app isn't locked to one tenant's locations.
export type Restaurant = string;

// Kept for backwards-compat with pages that still reference it as a label lookup.
// Returns empty object so callers fall back to the raw slug string via `?? r`.
export const RESTAURANT_LABELS: Record<string, string> = {};

export type LineItem = {
  description: string;
  quantity: number | null;
  unit: string | null;           // kg, pz, lt, caja, etc.
  unitNormalized: string | null; // normalized unit: kg, g, l, ml, pz, caja, docena, bolsa, otros
  unitPrice: number | null;
  total: number;
  category: string | null;       // concepto value for this line item
};

export type ExtractedInvoice = {
  id: string;                    // uuid v4 assigned at parse time
  restaurant: Restaurant;
  invoiceDate: string;           // ISO yyyy-mm-dd
  supplier: string;
  invoiceNumber?: string;
  importe: number;               // net amount (before IVA)
  iva: number;
  total: number;

  concepto: string;              // must match sheet dropdown; "" means user must fill
  cuentaPnl: string;             // must match sheet dropdown; "" means user must fill
  comments?: string;             // Comentarios adicionales

  lineItems?: LineItem[];        // individual products/services from invoice

  extractionConfidence?: number; // 0-1 from LLM
  mathWarning?: boolean;         // true when importe + iva ≠ total
  extractionMethod: "llm_vision" | "llm_text";
  fileUrl?: string;              // Supabase Storage path for original file
};

export type SessionData = {
  isLoggedIn: boolean;
  userId?: string;
  tenantId?: string;
  email?: string;
  name?: string;     // display name from Google (user.user_metadata.full_name)
  role?: "admin" | "member" | "readonly";
};

export type SupplierEntry = {
  concepto: string;
  cuentaPnl: string;
};

export type DropdownsResponse = {
  concepto: string[];
  cuentaPnl: string[];
  restaurants: Array<{ value: Restaurant; label: string }>;
  sheetRegistry: Record<string, string>;
};

export type ParseApiResponse = {
  invoices: ExtractedInvoice[];
  errors?: Array<{ filename: string; error: string }>;
};

export type DuplicateMatch = {
  supplier: string;
  invoiceNumber?: string;
  total: number;
  invoiceDate: string;
};

export type SubmitApiBody = {
  invoices: ExtractedInvoice[];
  bypassDuplicates?: boolean;
};

export type SubmitResult = {
  invoiceId: string;
  status: "appended" | "duplicate_warning" | "error";
  spreadsheetUrl?: string;
  duplicateMatches?: DuplicateMatch[];
  error?: string;
};

export type SubmitApiResponse = {
  results: SubmitResult[];
  appended: number;
};
