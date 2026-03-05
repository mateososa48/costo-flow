# Aventura Gourmet — Invoice Processing Webapp

Internal webapp for Aventura Gourmet BOH admins to upload supplier invoices (PDFs or photos), extract key fields using AI vision, and append results to the correct monthly Google Sheets P&L workbook.

---

## Features

- **AI extraction** — Upload PDFs or photos (including handwritten invoices); GPT-4.1-mini extracts supplier, date, folio, importe, IVA, and total automatically
- **Batch uploads** — Process multiple invoices in one session
- **Mobile-first** — Camera capture on mobile, responsive layout, bottom nav, iOS zoom fixes
- **Restaurant selector** — Choose restaurant once on the review screen; applies to all invoices in the batch
- **Review & edit** — Editable invoice cards before submission; fields flagged when Concepto or Cuenta P&L are missing
- **Duplicate detection** — Warns before submitting if a matching invoice already exists in the sheet
- **Draft saving** — Unsubmitted batches are saved as drafts in the browser and can be resumed later
- **History** — Every submitted batch is logged locally; viewable in the History tab
- **Settings** — Theme toggle (light/dark), shared password management, user list management, sheet registry viewer
- **Interactive tutorial** — Step-by-step onboarding overlay, auto-shown on first login, relaunchable from Settings
- **Dark mode** — Full dark/light theme with system-level color-scheme for native controls
- **Vercel Analytics** — Built-in usage tracking

---

## Pages

| Route | Description |
|---|---|
| `/login` | Name selector + shared password |
| `/upload` | File upload zone + draft management |
| `/review` | Edit extracted invoice data, select restaurant, submit |
| `/success` | Confirmation with links to destination sheets |
| `/history` | Local log of all submitted invoices |
| `/settings` | Theme, password, users, sheet registry, tutorial |

---

## Architecture

### Frontend
- **Next.js 15** App Router, all pages client-rendered (`"use client"`)
- **Tailwind CSS** with custom CSS variables for theming
- **Fonts:** Plus Jakarta Sans (display) + Inter (body) via `next/font`
- **Shell component** — desktop sidebar (≥ md) + mobile top bar + mobile bottom nav
- **State persistence** — `sessionStorage` for in-flight invoices, `localStorage` for drafts and history

### Backend (Next.js Route Handlers)
| Route | Method | Description |
|---|---|---|
| `/api/auth/login` | POST | Validate name + password, issue iron-session cookie |
| `/api/auth/logout` | POST | Clear session |
| `/api/invoices/parse` | POST | Accept file(s), run AI extraction, return `ExtractedInvoice[]` |
| `/api/invoices/submit` | POST | Duplicate check + append rows to Google Sheets |
| `/api/config/dropdowns` | GET | Return concepto/cuentaPnl options, admin names, sheet registry |
| `/api/settings/password` | POST | Change shared password (writes to `/tmp` on Vercel) |
| `/api/settings/users` | GET / POST | Read/update admin name list (writes to `/tmp` on Vercel) |

### Auth
- **iron-session** — encrypted, signed cookie-based sessions
- `SESSION_PASSWORD` must be ≥ 32 characters or middleware rejects all requests
- Middleware protects all routes except `/login` and `/api/auth/*`

### AI Extraction
- Model: **GPT-4.1-mini** (vision)
- PDFs are rendered to images server-side before being sent to the model
- System prompt instructs the model on Mexican invoice number formatting (period = decimal separator, not thousands)
- Structured JSON output with `extractionConfidence` (0–1)

### Google Sheets
- Service account authentication via `googleapis`
- One spreadsheet per restaurant per month, registered in `SHEET_REGISTRY`
- Appends to the `Informe de Gastos` tab, columns A:I:
  1. Fecha de factura
  2. Proveedor Autorizado
  3. Nº Factura
  4. Importe
  5. IVA
  6. Total
  7. Concepto
  8. Cuenta P&L
  9. Comentarios adicionales
- Google Sheets API retries up to 3 times on transient errors
- Duplicate check: same supplier + (same invoice number OR same total) within same month

### Dynamic Settings (Vercel)
`data/settings-override.json` is bundled at deploy time as defaults. Runtime changes (password, user list) are written to `/tmp/settings-override.json` on Vercel (ephemeral per function instance — resets on cold start/redeploy). The bundled file acts as the permanent fallback.

---

## Data Model

```ts
type Restaurant = "motin_juarez" | "motin_roma" | "queseria";

type ExtractedInvoice = {
  id: string;                    // uuid v4
  restaurant: Restaurant;
  invoiceDate: string;           // ISO yyyy-mm-dd
  supplier: string;
  invoiceNumber?: string;
  importe: number;               // net (before IVA)
  iva: number;
  total: number;
  concepto: string;              // must match sheet dropdown; "" = user must fill
  cuentaPnl: string;             // must match sheet dropdown; "" = user must fill
  comments?: string;
  extractionConfidence?: number; // 0–1
  extractionMethod: "llm_vision" | "llm_text";
};
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in all values.

```env
# Auth
ADMIN_NAMES="Maria,Juan,Sofia,Carlos"   # Comma-separated names for login dropdown
SHARED_PASSWORD="..."                    # Shared password for all users
SESSION_PASSWORD="..."                   # ≥32 random chars — signs session cookies

# OpenAI
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4.1-mini"             # Must support vision

# Google Sheets (Service Account)
GOOGLE_SERVICE_ACCOUNT_EMAIL="..."
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"

# Sheet Registry — one Spreadsheet ID per (restaurant, year, month)
# Key format: {restaurant}_{YYYY}_{MM}
SHEET_REGISTRY='{"motin_juarez_2025_01":"SPREADSHEET_ID","motin_roma_2025_01":"SPREADSHEET_ID"}'

# Audit Log (optional)
AUDIT_LOG_SPREADSHEET_ID="SPREADSHEET_ID"
```

---

## Google Sheets Setup

1. Create a Google Cloud project and enable the **Google Sheets API**
2. Create a **Service Account** and download the JSON key
3. Set `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` from the key file
4. For each monthly workbook: share the spreadsheet with the service account email (Editor role)
5. Add each spreadsheet ID to `SHEET_REGISTRY` with the key `{restaurant}_{YYYY}_{MM}`
6. Ensure each workbook has a tab named exactly `Informe de Gastos`

---

## Local Development

```bash
npm install
cp .env.example .env.local
# fill in .env.local
npm run dev
```

---

## Deployment

Deployed on **Vercel**. All environment variables must be set in the Vercel project dashboard.

```bash
vercel deploy --prod
```

> **Note:** Settings changed via the UI (password, user list) are stored in `/tmp` on Vercel and are ephemeral — they reset on cold starts and redeployments. To make permanent changes, update `data/settings-override.json` and redeploy.

---

## Restaurants

| Key | Display name |
|---|---|
| `motin_juarez` | Motín Juárez |
| `motin_roma` | Motín Roma |
| `queseria` | Quesería |
