export type Restaurant = "motin_juarez" | "motin_roma" | "queseria";

export const RESTAURANT_LABELS: Record<Restaurant, string> = {
  motin_juarez: "Motín Juárez",
  motin_roma: "Motín Roma",
  queseria: "Quesería",
};

export type LineItem = {
  description: string;
  quantity: number | null;
  unit: string | null;           // kg, pz, lt, caja, etc.
  unitPrice: number | null;
  total: number;
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
  extractionMethod: "llm_vision" | "llm_text";
};

export type SessionData = {
  user?: string;
  isLoggedIn: boolean;
};

export type SupplierEntry = {
  concepto: string;
  cuentaPnl: string;
};

export type DropdownsResponse = {
  concepto: string[];
  cuentaPnl: string[];
  restaurants: Array<{ value: Restaurant; label: string }>;
  adminNames: string[];
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
