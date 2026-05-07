# Product

## Register

product

## Users

Three overlapping roles, all sharing the same tool:

- **Restaurant manager / chef**: Handles daily purchasing and invoice entry, often on a phone in the kitchen or back office. High task frequency, low patience for friction. Common flow: photograph an invoice, confirm the AI extraction, submit.
- **Back-office accountant / admin**: Reconciles invoices at a desktop. Needs accuracy, editability, and data that exports cleanly to Google Sheets. Uses the Compras and Gastos dashboards heavily.
- **Restaurant group owner**: Monitors costs across locations via dashboards and KPIs. Less involved in daily entry, more interested in trends and P&L alignment.

All three are professional users. None are tech-averse, but none are power users in the software sense. They know their numbers.

## Product Purpose

Costoflow is an AI-powered invoice management and cost-tracking tool for restaurant groups. Operators upload supplier invoices (PDFs, photos, handwritten) and the AI extracts supplier, date, folio, amounts, and line items. Extracted data is reviewed, classified by concepto and cuenta P&L, then submitted to monthly Google Sheets P&L workbooks and persisted in Supabase for dashboard analysis.

Success looks like: a restaurant group capturing all their purchasing costs accurately, with minimal manual data entry, in a workflow that fits how kitchens actually operate.

## Brand Personality

Polished, precise, unhurried. A professional tool that's confident in what it does — not trying to be exciting, not trying to be enterprise-heavy. Three words: **clear, capable, trusted**.

The voice is direct Spanish (Mexican restaurant context) without jargon. Labels and feedback messages should be plain and honest, never over-reassuring.

## Anti-references

- **Heavy enterprise software** (SAP, Oracle, legacy ERPs): no dense gray chrome, no modal-heavy workflows, no 12-column forms, no toolbar ribbons.
- **Generic SaaS clones**: avoid the pattern of indigo buttons on white cards with stock-photo heroes. The design should feel like it was built for this specific domain.
- **Consumer-app playfulness**: no gamification, mascots, celebration confetti, or emoji-heavy UI. This is accounting data — precision is trust.

## Design Principles

1. **Density is a feature.** Restaurant operators work with a lot of data. The right answer is not always to hide or collapse — it's to display clearly, with strong hierarchy.
2. **Kitchen-to-office continuity.** The same screen is used on a phone in a kitchen and a 27-inch monitor in an office. Both must feel native and deliberate — not one resized to fit the other.
3. **Earned trust through precision.** Accounting data is high-stakes. The UI should feel exact: tabular numbers, clear error states, no ambiguous labels, no layout drift. Doubt is a design failure.
4. **Speed respects the operator.** Common flows (upload → review → submit) must be fast and low-friction. Confirmations only where the action is destructive or irreversible.
5. **Product-register restraint.** Design serves the data, not the other way around. Decoration that doesn't carry meaning gets removed. Color earns its place.

## Accessibility & Inclusion

- WCAG AA contrast minimum for all text and interactive elements.
- Tap targets: minimum 44px for mobile users operating one-handed in a kitchen environment.
- Keyboard navigation for desktop accountants doing high-volume entry.
- iOS Safari: inputs forced to 16px to prevent zoom on focus.
- Reduced motion: respect `prefers-reduced-motion` for any animated transitions.
