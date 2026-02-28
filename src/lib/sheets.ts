import { google } from "googleapis";
import { config } from "@/config";
import type { ExtractedInvoice, DuplicateMatch } from "@/types";

const SHEET_TAB = "Informe de Gastos";
const AUDIT_TAB = "Audit Log";

function getAuth() {
  return new google.auth.JWT({
    email: config.google.serviceAccountEmail,
    key: config.google.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

/**
 * Format a yyyy-mm-dd date as dd/mm/yyyy (Spanish locale for Sheets).
 */
export function formatDateForSheet(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Convert an ExtractedInvoice to the 9-column sheet row array.
 * Columns A:I = Fecha, Proveedor, Nº Factura, Importe, IVA, Total, Concepto, Cuenta P&L, Comentarios
 */
export function invoiceToSheetRow(invoice: ExtractedInvoice): string[] {
  return [
    formatDateForSheet(invoice.invoiceDate),
    invoice.supplier,
    invoice.invoiceNumber ?? "",
    String(invoice.importe),
    String(invoice.iva),
    String(invoice.total),
    invoice.concepto,
    invoice.cuentaPnl,
    invoice.comments ?? "",
  ];
}

/**
 * Append a single row to the "Informe de Gastos" tab in a spreadsheet.
 * Finds the first empty row in column A starting from row 8 (the sheet has
 * pre-formatted formula rows below the header that fool the append API).
 * Returns the spreadsheet URL.
 */
export async function appendToSheet(
  spreadsheetId: string,
  invoice: ExtractedInvoice
): Promise<string> {
  const sheets = getSheetsClient();
  const row = invoiceToSheetRow(invoice);

  // Read column A from row 8 downward to find the first empty cell
  const readResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_TAB}!A8:A`,
  });

  const colA = (readResponse.data.values ?? []) as string[][];
  // Find the first index where A is blank
  let emptyIndex = colA.findIndex((r) => !r[0] || r[0].trim() === "");
  if (emptyIndex === -1) emptyIndex = colA.length; // all filled — go to next row
  const targetRow = 8 + emptyIndex; // 1-indexed sheet row

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_TAB}!A${targetRow}:I${targetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}

/**
 * Check for potential duplicate rows in the target sheet.
 * Duplicate = same Supplier AND (same Invoice Number OR same Total) in same month.
 */
export async function checkDuplicates(
  spreadsheetId: string,
  invoice: ExtractedInvoice
): Promise<DuplicateMatch[]> {
  const sheets = getSheetsClient();

  let rows: string[][];
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_TAB}!A:I`,
    });
    rows = (response.data.values ?? []) as string[][];
  } catch {
    // If sheet doesn't exist yet or is empty, no duplicates
    return [];
  }

  if (rows.length === 0) return [];

  const [invoiceYear, invoiceMonth] = invoice.invoiceDate.split("-");
  const matches: DuplicateMatch[] = [];

  for (const row of rows) {
    // Skip header rows or malformed rows
    if (!row[0] || !row[1]) continue;

    // Parse date from dd/mm/yyyy format
    const dateParts = row[0].split("/");
    if (dateParts.length !== 3) continue;
    const [, rowMonth, rowYear] = dateParts;

    // Must be same month
    if (rowYear !== invoiceYear || rowMonth !== invoiceMonth) continue;

    const rowSupplier = (row[1] ?? "").toLowerCase().trim();
    const rowInvoiceNumber = row[2]?.trim() ?? "";
    const rowTotal = parseFloat(row[5] ?? "0");

    const supplierMatch = rowSupplier === invoice.supplier.toLowerCase().trim();
    const invoiceNumberMatch =
      invoice.invoiceNumber &&
      rowInvoiceNumber &&
      rowInvoiceNumber === invoice.invoiceNumber.trim();
    const totalMatch = Math.abs(rowTotal - invoice.total) < 0.01;

    if (supplierMatch && (invoiceNumberMatch || totalMatch)) {
      matches.push({
        supplier: row[1],
        invoiceNumber: row[2] || undefined,
        total: rowTotal,
        invoiceDate: row[0],
      });
    }
  }

  return matches;
}

/**
 * Append an audit record to the audit log spreadsheet.
 */
export async function appendAuditLog(entry: {
  user: string;
  restaurant: string;
  invoiceDate: string;
  supplier: string;
  invoiceNumber?: string;
  total: number;
  status: "submitted" | "duplicate_bypassed";
}): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = config.sheets.auditLogId;

  const row = [
    new Date().toISOString(),
    entry.user,
    entry.restaurant,
    entry.invoiceDate,
    entry.supplier,
    entry.invoiceNumber ?? "",
    String(entry.total),
    entry.status,
  ];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${AUDIT_TAB}!A:H`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  } catch (err) {
    // Log audit failures but don't block the submit
    console.error("[audit-log] Failed to write audit entry:", err);
  }
}
