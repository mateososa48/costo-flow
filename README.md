# Aventura Gourmet BOH — Invoice Processing Webapp

Internal webapp for Aventura Gourmet BOH admins to upload supplier invoices (PDFs or photos),
extract key fields (including handwritten invoices), and append results into the correct monthly
Google Sheets P&L workbook.

## Scope (MVP)
- Internal-only tool (not public)
- Simple auth: choose admin user + shared password
- Upload invoices (single or batch) from desktop or mobile (camera integration)
- Extract invoice-level fields (NOT line items)
- Auto-route invoice rows into the correct Google Sheet by:
  - Restaurant (user selected)
  - Month/Year (derived from extracted invoice date)
- Warn (not block) potential duplicates
- Audit log of processing activity
- Dark mode support
- No editing of existing entries (edits happen manually in Google Sheets)

### Out of scope for MVP (planned later)
- Splitting one invoice across restaurants / months
- Manual override routing via free-text notes
- Storing invoice files in Drive
- Line-item extraction
- Full admin dashboard analytics

---

## Business Rules

### Restaurants
User selects one at upload time:
- Motín Juárez
- Motín Roma
- Quesería

### Sheets Structure
There is one Google Sheets workbook **per month per restaurant**.
Each workbook contains a tab named:

- `Informe de Gastos`

We append one row per invoice to columns A:I in that tab:

1) Fecha de factura  
2) Proveedor Autorizado  
3) Nº Factura  
4) Importe  
5) IVA  
6) Total  
7) Concepto  
8) Cuenta P&L  
9) Comentarios adicionales

**Note:** The P&L workbooks are identical across restaurants.

### Categorization
The Sheet requires dropdown values for:
- Concepto
- Cuenta P&L

MVP categorization strategy:
- Use a deterministic mapping table: `supplier_mapping.json`
- If supplier not found OR mapping missing -> require user selection in UI before submit
- Never invent values that aren’t in the dropdown list

---

## UX Flow (MVP)

### 1) Login
- User selects their name from a dropdown (4 admins)
- User enters a shared password (same for everyone)

### 2) Upload
- Upload PDF(s) or image(s)
- Mobile: camera capture supported

### 3) Review / Confirm
For each invoice, show an “invoice card” with editable fields:
- Restaurant (selected once globally; editable per invoice optional)
- Extracted Date (editable)
- Supplier (editable)
- Invoice # (editable; can be blank)
- Importe, IVA, Total (editable)
- Concepto + Cuenta P&L:
  - auto-filled by mapping when possible
  - otherwise user must select from dropdown options
- Comentarios adicionales (free text notes per invoice)

### 4) Submit
- Appends rows to correct monthly workbook based on extracted date (month/year) + restaurant.
- Shows warning modal if possible duplicate detected.

### 5) Success
- Show links to the destination workbook(s) and count of rows appended.

---

## Duplicate Warning Logic (MVP)
Before append, check destination sheet for a likely match:
- Same Supplier AND
- Same Invoice Number (if present) OR same Total
- Date within same month

If match found:
- Show warning + allow “Proceed anyway”.

---

## Architecture

### Frontend
- Next.js App Router
- Tailwind CSS + dark mode
- Responsive layout with mobile camera capture
- Pages:
  - `/login`
  - `/upload`
  - `/review`
  - `/success`
  - `/admin/mapping` (optional for MVP; can be JSON only at first)

### Backend (Next.js Route Handlers)
- `POST /api/auth/login`
- `POST /api/invoices/parse` (accept file(s), return extracted invoices)
- `POST /api/invoices/submit` (append to Google Sheets + audit log)
- `GET /api/config/dropdowns` (optional: fetch dropdown values, if needed)

### External Services
- LLM API (vision extraction) for PDFs/photos and handwritten invoices
- Google Sheets API (append rows)
- (Optional later) Google Drive API (store original invoice)

---

## Data Model (MVP)

### ExtractedInvoice
```ts
type ExtractedInvoice = {
  id: string;                     // internal UUID
  restaurant: "motin_juarez" | "motin_roma" | "queseria";
  invoiceDate: string;            // ISO yyyy-mm-dd
  supplier: string;
  invoiceNumber?: string;
  importe: number;                // net
  iva: number;
  total: number;

  concepto: string;               // must match sheet dropdown
  cuentaPnl: string;              // must match sheet dropdown
  comments?: string;              // "Comentarios adicionales"

  // for review/debugging
  extractionConfidence?: number;
  extractionMethod: "llm_vision";
  rawText?: string;               // optional: store OCR/parsed text for debugging (not persisted)
}