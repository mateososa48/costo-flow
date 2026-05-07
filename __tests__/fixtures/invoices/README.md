# Synthetic Invoice Fixtures

These fixtures are fake and for automated tests only. They are not valid tax documents, are not signed by a PAC, and should never be sent to SAT for validation.

Use them to test:

- CFDI XML parsing by namespace/local name.
- CFDI type routing: ingreso, egreso, pago, Carta Porte, missing timbre.
- Business validation: UUID identity, receptor matching, payment complement linking, substitutions, credit notes, mixed taxes, and malformed XML.
- Current app object-shape edge cases in `parsed/edge-case-parsed-invoices.json`.

Suggested future locations:

- Keep XML parser fixtures in `__tests__/fixtures/invoices/cfdi-xml`.
- Keep parsed `ExtractedInvoice` fixtures in `__tests__/fixtures/invoices/parsed`.
- Keep real anonymized production samples out of git unless all PII and fiscal identifiers are fully sanitized.

