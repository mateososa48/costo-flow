# Aventura Gourmet — Invoice Processing Webapp

Internal webapp for Aventura Gourmet BOH admins to upload supplier invoices (PDFs or photos), extract key fields using AI vision, and append results to the correct monthly Google Sheets P&L workbook. Also provides a Compras (purchasing) dashboard for browsing, editing, and analyzing line-item data stored in Supabase.

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
- **Compras dashboard** — Browse line items, invoices, suppliers, and analytics from Supabase; inline editing, supplier tagging, ingredient normalization
- **Gastos dashboard** — Operational expense tracking (Alimentos / Operativos sub-pages)
- **Settings** — Theme toggle (light/dark), shared password management, user list management, sheet registry viewer
- **Interactive tutorial** — Step-by-step onboarding overlay, auto-shown on first login, relaunchable from Settings
- **Dark mode** — Full dark/light theme with CSS custom properties and `color-scheme` for native controls
- **Vercel Analytics** — Built-in usage tracking

---

## Pages

| Route | Description |
|---|---|
| `/` | Root redirect |
| `/login` | Name selector + shared password |
| `/upload` | File upload zone + draft management |
| `/review` | Edit extracted invoice data, select restaurant, submit |
| `/success` | Confirmation with links to destination sheets |
| `/history` | Local log of all submitted invoices |
| `/compras` | Compras dashboard — items, invoices, suppliers, analytics, normalize |
| `/gastos` | Gastos dashboard — Alimentos & Operativos expense views |
| `/settings` | Theme, password, users, sheet registry, tutorial |

---

## Design System & Aesthetics

This section documents the visual design language of the app. Follow these conventions when building new features.

### Overall Aesthetic

Clean, data-dense, professional dashboard UI. The design is **flat with subtle depth** — thin borders, light shadows, no heavy gradients or skeuomorphism. Surfaces layer from `--bg` (base) → `--surface` (cards) → `--surface-raised` (hover/nested). The feel is closer to Linear or Vercel's dashboard than Material Design.

### Color Palette

All colors are defined as CSS custom properties in `globals.css` and swap automatically between light and dark mode.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--bg` | `#F8F8F7` (warm off-white) | `#111113` (near-black) | Page background |
| `--surface` | `#FFFFFF` | `#1C1C20` | Cards, panels, modal bodies |
| `--surface-raised` | `#F4F4F5` | `#242428` | Hover states, nested surfaces |
| `--border` | `#E4E4E7` | `#2E2E36` | Card borders, dividers |
| `--border-subtle` | `#F0F0F1` | `#242430` | Table row separators, light dividers |
| `--blue` | `#0350A9` | `#4A8AE8` | Primary accent — buttons, links, KPIs, active tabs |
| `--blue-light` | `#EBF2FF` | `#1A2A45` | Badge backgrounds, selected states |
| `--blue-dim` | `#3476CC` | `#6BA3F0` | Button hover tint |
| `--blue-glow` | `rgba(3,80,169,0.12)` | `rgba(74,138,232,0.15)` | Primary KPI card background |
| `--pink` | `#ECB8B7` | `#ECB8B7` | Brand accent (login gradient, decorative) |
| `--text` | `#18181B` | `#F4F4F6` | Primary text |
| `--text-muted` | `#71717A` | `#8B8B9B` | Secondary text, labels |
| `--text-dim` | `#A1A1AA` | `#55555F` | Placeholder text, tertiary info |
| `--danger` | `#DC2626` | `#F87171` | Destructive actions, errors |
| `--success` | `#16A34A` | `#4ADE80` | Success states |
| `--warning` | `#D97706` | `#FBBF24` | Warnings |

**Chart palette** (`BLUE_SHADES`): `#0450A9`, `#2E6EC4`, `#5589D4`, `#7AA5E0`, `#9DC0EC`, `#C0D9F5`, `#033D82`, `#1A5DB8`, `#3A7FCC`, `#042F6B`

**Brand palette** (defined in `tailwind.config.ts` under `brand.*`, used sparingly): warm dark tones — `#1a1714` bg, `#c8a882` gold, `#1b2a4a` navy.

### Typography

| Role | Font | Weights | CSS variable |
|---|---|---|---|
| Display / headings | **Plus Jakarta Sans** | 400, 500, 600, 700, 800 | `--font-display` (`--font-jakarta`) |
| Body / UI text | **Inter** | 300, 400, 500, 600 | `--font-body` (`--font-inter`) |

- Base font size: `15px`, line-height `1.6`
- Display headings: tight tracking (`letter-spacing: -0.04em`), line-height `1.15`
- Large KPI numbers: `text-2xl font-bold`, tracking `-0.03em`, `font-display`
- Section labels: `text-[10px] font-semibold uppercase tracking-widest` in `--text-dim`
- Table/list text: `text-xs` or `text-sm`
- Numbers: always `tabular-nums` for alignment
- iOS fix: inputs forced to `16px` on mobile to prevent Safari zoom

### Radius Tokens

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `0.5rem` (8px) | Buttons, inputs, small chips |
| `--radius` | `0.75rem` (12px) | Cards, panels, chart containers |
| `--radius-lg` | `1rem` (16px) | Modals |

### Shadow Tokens

| Token | Light | Dark |
|---|---|---|
| `--shadow-card` | `0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)` | `0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)` |
| `--shadow-elevated` | `0 8px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)` | `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)` |

### Component Patterns

**Buttons** (`src/components/ui/Button.tsx`)
- Variants: `primary`, `secondary`, `ghost`, `danger`
- Primary: `bg-[var(--blue)]` white text, hover → `--blue-dim`, `active:scale-[0.98]`
- Secondary: bordered card surface, hover → raised surface + dimmer border
- All buttons: `focus-visible:ring-2` with offset, `disabled:opacity-40`
- Loading state: border-spinner inside the button

**Inputs** (`src/components/ui/Input.tsx`)
- Surface background, 1px border, `--radius-sm` rounding
- Focus: blue ring (`focus:ring-[var(--blue)]/15`) + blue border
- Error: red border + red ring
- Labels: `text-xs font-medium uppercase tracking-wider` in `--text-muted`

**Modals** (`src/components/ui/Modal.tsx`)
- Backdrop: `backdrop-blur-sm` + `rgba(0,0,0,0.4)` overlay
- Panel: `--surface` background, `--border` stroke, `--shadow-elevated`, `--radius-lg`
- Title bar: bottom-bordered, `font-display text-xl font-bold`
- Entrance animation: `animate-fade-up` (0.25s)

**Cards / panels** (inline throughout pages)
- `rounded-[var(--radius)]`, `border` with `borderColor: var(--border)`, `background: var(--surface)`
- Padding: `p-4` standard
- Highlighted card (primary KPI): `borderColor: color-mix(in srgb, var(--blue) 30%, transparent)`, `background: var(--blue-glow)`

**Tabs / view switchers**
- Horizontal row of text buttons, active tab gets `--blue` color + `--blue-light` background pill
- Inactive tabs: `--text-muted`, hover → `--text`

**Sort pills**
- Small rounded buttons (`rounded-full`), active state shows `--blue` text on `--blue-light` background

**Data tables**
- No heavy table element — use stacked `div` rows with `border-b` in `--border-subtle`
- Inline bar charts: colored `div` bars behind text, width proportional to value

**KPI cards**
- Grid: `grid-cols-2 md:grid-cols-4 gap-3`
- Each card: bordered panel, `text-[10px]` uppercase label, `text-2xl font-bold` value
- Primary KPI: blue-glowed background, blue text

**Charts** (Recharts)
- Area charts with linear gradient fill (`stopOpacity` 0.15 → 0)
- `CartesianGrid`: dashed, horizontal only, stroke `var(--border)`
- Axis ticks: `fontSize: 10`, fill `var(--text-muted)`
- Tooltip: `var(--surface)` background, `var(--border)` stroke, `borderRadius: 6`

### Animations

| Class | Effect | Duration | Easing |
|---|---|---|---|
| `animate-fade-up` | `opacity 0→1` + `translateY 10px→0` | 0.35s | `cubic-bezier(0.16, 1, 0.3, 1)` (spring) |
| `animate-fade-in` | `opacity 0→1` | 0.25s | ease |
| `animate-spin` | continuous rotation | 0.75s | linear |
| `.stagger > *` | children fade-up with 40ms delay each | 0.35s | spring easing |

### Icons

Hand-coded inline SVGs throughout — no icon library. Stroke-based, `width/height 18`, `strokeWidth` toggles between `1.5` (inactive) and `2` (active). Icons used for: Upload, History, Compras (shopping bag), Gastos (credit card), Settings (gear), search, chevrons, close (X), sort arrows.

### Layout

- **Shell** (`src/components/Shell.tsx`): desktop sidebar (240px, `--sidebar-width`) + mobile top bar + mobile bottom nav
- Main content: `max-w-6xl` centered with `px-4 md:px-8` horizontal padding
- Grids: `grid md:grid-cols-2`, `grid md:grid-cols-4`, `grid md:grid-cols-5`
- Spacing: `gap-3`, `gap-4`, `space-y-4` — consistent 12px/16px rhythm
- Responsive: mobile-first, breakpoints at `md` (768px)

### Dark Mode

- Toggled by adding/removing `dark` class on `<html>`
- Persisted in `localStorage` under key `'theme'`
- Flash-free: inline `<script>` in `<head>` reads localStorage before paint
- `color-scheme: light/dark` set for native controls (scrollbars, date pickers)
- All colors swap via CSS custom properties — no Tailwind `dark:` prefixes needed

### Login Page

- Full-screen split: left panel with blue→pink diagonal gradient (`linear-gradient(135deg, #0350A9 0%, #ECB8B7 100%)`), right panel with form
- The gradient is the primary brand moment in the app

---

## Architecture

### Frontend
- **Next.js 15** App Router, all pages client-rendered (`"use client"`)
- **Tailwind CSS** with CSS custom properties for theming (no Tailwind color utilities for theme colors)
- **Recharts** for analytics charts (area charts, bar visualizations)
- **Fonts:** Plus Jakarta Sans (display) + Inter (body) via `next/font/google`
- **Shell component** — desktop sidebar (>= md) + mobile top bar + mobile bottom nav
- **State persistence** — `sessionStorage` for in-flight invoices, `localStorage` for drafts, history, and theme

### Backend (Next.js Route Handlers)

| Route | Method | Description |
|---|---|---|
| `/api/auth/login` | POST | Validate name + password, issue iron-session cookie |
| `/api/auth/logout` | POST | Clear session |
| `/api/auth/me` | GET | Return current session user (auto-login check) |
| `/api/invoices/parse` | POST | Accept file(s), run AI extraction, return `ExtractedInvoice[]` |
| `/api/invoices/submit` | POST | Duplicate check + append rows to Google Sheets |
| `/api/config/dropdowns` | GET | Return concepto/cuentaPnl options, admin names, sheet registry |
| `/api/settings/password` | POST | Change shared password |
| `/api/settings/users` | GET / POST | Read/update admin name list |
| `/api/compras` | GET | Fetch line items from Supabase with filters, pagination, stats |
| `/api/compras/[id]` | PATCH | Update a single line item |
| `/api/compras/analytics` | GET | KPIs, trends, category/supplier breakdowns |
| `/api/compras/stats` | GET | Summary stats for compras data |
| `/api/compras/invoices/[id]` | GET/PATCH/DELETE | Manage individual invoices |
| `/api/compras/suppliers/tags` | GET / POST | Read/update supplier tags |
| `/api/compras/ingredients/*` | GET / POST | Ingredient normalization, suggestions, backfill |
| `/api/compras/line-items/*` | POST | Backfill cost-type and units |
| `/api/compras/price-stats` | GET | Price statistics for items |
| `/api/gastos` | GET | Fetch operational expense data |
| `/api/audit-log` | POST | Write to audit log spreadsheet |

### Auth
- **iron-session** — encrypted, signed cookie-based sessions
- `SESSION_PASSWORD` must be >= 32 characters or middleware rejects all requests
- Middleware protects all routes except `/login` and `/api/auth/*`

### AI Extraction
- Model: **GPT-4.1-mini** (vision)
- PDFs are rendered to images server-side before being sent to the model
- System prompt instructs the model on Mexican invoice number formatting (period = decimal separator, not thousands)
- Structured JSON output with `extractionConfidence` (0-1)

### Google Sheets
- Service account authentication via `googleapis`
- One spreadsheet per restaurant per month, registered in `SHEET_REGISTRY`
- Appends to the `Informe de Gastos` tab, columns A:I
- Google Sheets API retries up to 3 times on transient errors
- Duplicate check: same supplier + (same invoice number OR same total) within same month

### Supabase
- **Server-side only** via service role key
- Tables: `invoices`, `line_items`, `app_settings`
- `app_settings` — single row (key=`'main'`), JSONB value with `adminNames` + `sharedPassword`
- Settings cascade: Supabase → bundled `data/settings-override.json` fallback

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
  extractionConfidence?: number; // 0-1
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
SESSION_PASSWORD="..."                   # >=32 random chars — signs session cookies

# OpenAI
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4.1-mini"             # Must support vision

# Supabase
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

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

Deployed on **Vercel** (Hobby plan). All environment variables must be set in the Vercel project dashboard.

```bash
vercel deploy --prod
```

---

## Restaurants

| Key | Display name |
|---|---|
| `motin_juarez` | Motín Juárez |
| `motin_roma` | Motín Roma |
| `queseria` | Quesería |
