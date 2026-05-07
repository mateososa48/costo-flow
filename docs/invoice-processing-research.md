# Invoice Processing Research And Improvement Plan

Date: 2026-04-25

This note summarizes the current CostoFlow invoice-processing flow, the Mexican CFDI research, likely failure modes, and a practical upgrade path. The main conclusion is straightforward: for Mexican invoices, the CFDI XML and SAT status should become the source of truth. PDF/photo AI extraction is still valuable, but mostly as a fallback for missing XML and as an operational parser for human-facing details.

## External Research

Primary sources used:

- SAT Anexo 20 / CFDI 4.0 overview: https://wwwmat.sat.gob.mx/consultas/35025/formato-de-factura-electronica-%28anexo-20%29
- SAT CFDI verification portal: https://verificacfdi.facturaelectronica.sat.gob.mx/
- SAT "Verifica tus facturas electronicas": https://wwwmat.sat.gob.mx/aplicacion/80523/verifica-tus-facturas-electronicas
- SAT cancellation process: https://www.sat.gob.mx/minisitio/Factura/cancela_procesocancelacion.htm
- SAT payment complement: https://wwwmat.sat.gob.mx/consultas/92764/comprobante-de-recepcion-de-pagos
- SAT Carta Porte: https://wwwmat.sat.gob.mx/consultas/68823/complemento-carta-porte-
- SAT Carta Porte verification: https://wwwmat.sat.gob.mx/aplicacion/76691/verifica-el-complemento-carta-porte
- SAT Anexo 20 technical PDF: https://www.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461175118249&ssbinary=true

Key findings:

- CFDI 4.0 has been the only valid CFDI version since 2023-04-01.
- CFDI 4.0 requires receptor name, receptor fiscal regime, receptor fiscal postal code, `Exportacion`, and concept-level `ObjetoImp`.
- A valid fiscal invoice must have a `tfd:TimbreFiscalDigital` complement with UUID, certification timestamp, PAC RFC, SAT certificate, and seals.
- SAT status can change after upload. An invoice can be valid when received and later canceled or substituted.
- Cancellation reasons are `01` with relation, `02` without relation, `03` operation did not occur, and `04` nominative operation in a global invoice. Substitutions use reason `01` and link the replacement UUID.
- `MetodoPago=PPD` invoices need payment CFDIs with the payment complement. The payment CFDI should be linked to the original invoice, not booked as a new AP expense.
- Carta Porte 3.1 is relevant for transported goods/merchandise and is the valid Carta Porte complement version with CFDI 4.0 from 2024-07-17.
- Negative numbers do not apply in CFDI 4.0. Returns/discounts should usually appear as egreso credit-note CFDIs, not negative invoice lines.

## Current Local Flow

Current path:

1. `/upload` selects restaurant and files, then posts multipart `FormData` to `/api/invoices/parse`.
2. `/api/invoices/parse` accepts PDF/JPEG/PNG/WEBP/HEIC/HEIF. PDFs go through `src/lib/pdf.ts`; clean text PDFs use text extraction, scanned/garbled PDFs render to PNG images. Images go to OpenAI vision after optional compression.
3. `src/lib/openai.ts` asks the model for invoice header data, totals, line items, categories, normalized units, and confidence using strict JSON schema.
4. Parsed invoices are stored in `sessionStorage` and reviewed in `/review`.
5. `/api/invoices/submit` validates dropdown values, checks duplicates, appends to Google Sheets, then saves invoice headers and line items to Supabase.
6. Supabase powers `/compras` and `/gastos`; Google Sheets remains the primary accounting append target.

Important local files:

- `src/app/api/invoices/parse/route.ts`
- `src/lib/openai.ts`
- `src/lib/pdf.ts`
- `src/app/review/page.tsx`
- `src/components/InvoiceCard.tsx`
- `src/app/api/invoices/submit/route.ts`
- `src/lib/sheets.ts`
- `src/lib/supabase.ts`

## Highest Risk Problems

1. PDF/photo OCR is treated as the primary extraction path.
   For Mexican AP, this is the wrong authority model. The app should request/accept XML first, parse deterministic XML fields, and use OCR only when XML is missing or for operational addenda-style details.

2. There is no CFDI identity model.
   The current `ExtractedInvoice` has supplier, date, invoice number, totals, and line items, but no issuer RFC, receiver RFC, UUID, timbre fields, CFDI version, `TipoDeComprobante`, `MetodoPago`, `FormaPago`, `UsoCFDI`, currency, exchange rate, SAT status, cancellation status, or related UUIDs.

3. Duplicate detection is weak for Mexico.
   Current duplicate logic is same supplier plus same month plus invoice number or total. CFDI duplicate identity should primarily be UUID, then issuer RFC + series/folio + receiver RFC, with restaurant/legal-entity scoping.

4. Supabase duplicate checks are not tenant- or restaurant-scoped.
   `checkDuplicatesViaSupabase` queries `invoices` by supplier/date only. It can create cross-tenant or cross-restaurant duplicate warnings.

5. Submit drops useful extraction fields.
   The submit Zod schema omits `lineItems[].category`, `lineItems[].unitNormalized`, `fileUrl`, and `mathWarning`. These can disappear between parse and persistence.

6. Text PDF extraction is mislabeled as vision.
   Parsed text PDFs are returned with `extractionMethod: "llm_vision"` even when `extractInvoiceFromText` was used.

7. Image MIME handling can be wrong.
   The non-PDF path sends `image/jpeg` to OpenAI even when the underlying small file remains PNG, WEBP, or HEIC.

8. Supabase invoice upsert can duplicate line items.
   `saveInvoiceWithItems` upserts the invoice header but always inserts line items. Re-saving the same invoice id can duplicate rows.

9. There is no SAT revalidation lifecycle.
   The flow does not re-check cancellation/status before payment, month close, or export.

10. Payment complements and credit notes are not modeled.
   A `TipoDeComprobante=P` payment complement could be parsed as an expense. A `TipoDeComprobante=E` credit note could be treated as a positive spend instead of a reversal/adjustment.

11. Receptor validation is missing.
   For multi-entity restaurants, the selected restaurant should map to a legal entity RFC/name/postal code/regime. The app should fail or block invoices whose receptor data does not match.

12. Tests do not exercise the real critical flow.
   Current Jest tests cover copied pure logic and supplier mapping. There are no fixtures/tests for CFDI XML parsing, parse-route validation, duplicate identity, payment complements, or cancellation handling.

## Recommended Architecture

### Phase 1: Make XML First-Class

- Accept `.xml` uploads alongside PDF/images.
- Add a deterministic CFDI parser using a namespace-aware XML parser.
- Store original XML bytes, parsed fiscal fields, and original PDF/photo separately.
- If a user uploads a PDF/photo only, mark the invoice as `pending_xml` or `non_fiscal_pending_verification`.
- Parse QR text from PDFs/images when possible to extract UUID, issuer RFC, receiver RFC, total, and seal suffix.

Suggested model additions:

- `cfdi_uuid`
- `cfdi_version`
- `tipo_comprobante`
- `issuer_rfc`, `issuer_name`, `issuer_regimen_fiscal`
- `receiver_rfc`, `receiver_name`, `receiver_postal_code`, `receiver_regimen_fiscal`, `uso_cfdi`
- `serie`, `folio`
- `fecha_emision`, `fecha_timbrado`
- `metodo_pago`, `forma_pago`, `moneda`, `tipo_cambio`
- `subtotal`, `descuento`, `tax_total`, `withholding_total`, `total`
- `sat_status`, `sat_status_checked_at`, `estatus_cancelacion`
- `related_cfdis`, `payment_complement_for`, `replacement_for`
- `source_artifact_type`, `source_artifact_path`, `validation_status`, `validation_errors`

### Phase 2: Add Validation Layers

Validation order should be deterministic first, AI second:

1. XML well-formed and namespace-aware parse.
2. CFDI `Version=4.0` except explicit legacy handling.
3. Required attributes and timbre present.
4. Catalog checks for payment method, form of payment, currency, CFDI use, tax object, product/service and unit keys.
5. Arithmetic checks using decimal math, not JavaScript floats.
6. Receptor legal entity match for selected restaurant.
7. SAT status check by UUID/RFCs/total or XML upload.
8. Related CFDI graph checks for substitutions, egresos, payment complements, and Carta Porte.

### Phase 3: Make AI A Reconciliation Assistant

- Ask AI to classify supplier category, food/beverage/ops cost type, ingredient aliases, and operational fields.
- Make AI output provenance: XML path, PDF text, QR value, or user edit.
- Lower confidence or block submission when AI/PDF disagrees with XML.
- Use AI for hard cases: scanned vendor tickets, handwritten delivery notes, addenda/PO parsing, and ingredient normalization.

### Phase 4: Operational Hardening

- Queue invoice processing jobs instead of doing all files in one request.
- Track per-file states: uploaded, parsing, parsed, needs review, rejected, submitted, synced.
- Add user-facing validation messages for vendor follow-up.
- Re-check SAT status before payment run and month close.
- Add vendor portal guidance: "Upload XML + PDF when available."
- Make Supabase the canonical data store, then sync Sheets as an integration target with retry/idempotency.

## Immediate Code Fixes

These are small and high leverage:

- Preserve `extractionMethod` correctly for text vs vision PDF paths.
- Send the correct MIME type to OpenAI after image compression/conversion.
- Extend submit schema to keep `lineItems[].category`, `lineItems[].unitNormalized`, `fileUrl`, and `mathWarning`.
- Scope Supabase duplicate checks by `tenant_id` and probably restaurant/legal entity.
- Add a UUID-capable duplicate identity once XML is parsed.
- Make line-item saves idempotent by deleting/replacing line items for the invoice id or adding stable line item ids/upserts.
- Add maximum file count/page count/size controls to avoid expensive batch spikes.
- Update README because auth and sheet registry documentation are stale.

## Test Fixture Pack

Synthetic fixtures were added under `__tests__/fixtures/invoices`. They are intentionally fake and should not be sent to SAT. They are meant for parser, validator, and business-rule tests.

Recommended test groups:

- XML parser tests for each `cfdi-xml/*.xml` file.
- Business-rule tests from `test-case-catalog.json`.
- Existing app-shape tests using `parsed/edge-case-parsed-invoices.json`.
- Duplicate identity tests: UUID, issuer+folio+receiver, supplier/month fallback.
- Submit validation tests for dropdowns, line item metadata preservation, and tenant scoping.
- SAT lifecycle tests with mocked status responses: vigente, cancelado, sustitucion, not found.

## Roadmap

P0:

- Add XML upload/parser/storage.
- Add CFDI UUID and issuer/receiver fields to invoice model.
- Fix the current data-loss bugs and duplicate scoping.
- Reject or clearly quarantine payment complements, credit notes, and missing-timbre XMLs until modeled.

P1:

- Add SAT status checks and status refresh jobs.
- Add restaurant legal entity matching.
- Model related CFDIs: replacement, credit note, payment complement, Carta Porte.
- Add fixture-driven tests for parser and submit route.

P2:

- Build a full invoice work queue.
- Make Supabase canonical and Sheets a sync target.
- Add field provenance and reconciliation UI.
- Add vendor-facing upload expectations and AP exception workflows.
