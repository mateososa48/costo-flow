import { google } from "googleapis";
import { config } from "@/config";
import log from "@/lib/logger";
import type { ExtractedInvoice, DuplicateMatch } from "@/types";

const SHEET_TAB = "Informe de Gastos";
const AUDIT_TAB = "Audit Log";
const SPANISH_MONTH_ABBREVIATIONS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

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

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err instanceof Error &&
        (err.message.includes("429") || err.message.includes("5") || err.message.includes("ECONNRESET"));
      if (!isRetryable || attempt === retries - 1) throw err;
      await new Promise((res) => setTimeout(res, 500 * 2 ** attempt));
    }
  }
  throw new Error("Max retries exceeded");
}

/**
 * Format a yyyy-mm-dd date as d-mmm-yy for the main invoice sheet.
 */
export function formatDateForSheet(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  const monthIndex = Number(month) - 1;
  const monthName = SPANISH_MONTH_ABBREVIATIONS[monthIndex];
  if (!monthName) return isoDate;

  return `${Number(day)}-${monthName}-${year.slice(-2)}`;
}

function parseSheetDateParts(sheetDate: string): { year: string; month: string } | null {
  const slashParts = sheetDate.split("/");
  if (slashParts.length === 3) {
    const [, month, year] = slashParts;
    if (!/^\d{2}$/.test(month) || !/^\d{4}$/.test(year)) return null;
    return { year, month };
  }

  const dashParts = sheetDate.toLowerCase().split("-");
  if (dashParts.length === 3) {
    const [, monthName, shortYear] = dashParts;
    const monthIndex = SPANISH_MONTH_ABBREVIATIONS.indexOf(monthName as typeof SPANISH_MONTH_ABBREVIATIONS[number]);
    if (monthIndex === -1 || !/^\d{2}$/.test(shortYear)) return null;

    return {
      year: `20${shortYear}`,
      month: String(monthIndex + 1).padStart(2, "0"),
    };
  }

  return null;
}

/**
 * Format a number for Spanish-locale Google Sheets (USER_ENTERED mode).
 * Uses comma as the decimal separator so Sheets doesn't misread the dot
 * as a thousands separator (which can mangle values or trigger date parsing).
 */
function formatNumber(n: number): string {
  return String(n).replace(".", ",");
}

/**
 * Convert an ExtractedInvoice to the 9-column sheet row array.
 * Columns A:I = Fecha, Proveedor, Nº Factura, Importe, IVA, Total, Concepto, Cuenta P&L, Comentarios
 */
export function invoiceToSheetRow(invoice: ExtractedInvoice): string[] {
  // Strip any non-digit characters from invoice number (letters, dashes, prefixes).
  const invoiceNumber = (invoice.invoiceNumber ?? "").replace(/\D/g, "");
  return [
    formatDateForSheet(invoice.invoiceDate),
    invoice.supplier,
    invoiceNumber,
    formatNumber(invoice.importe),
    formatNumber(invoice.iva),
    formatNumber(invoice.total),
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

  // Read columns A and B from row 8 to find the last row with any content.
  // Checking both columns handles manually-entered rows that leave column A blank.
  const readResponse = await withRetry(() => sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_TAB}!A8:B`,
  }));

  const rows = (readResponse.data.values ?? []) as string[][];
  // Find the LAST row with a date in column A (actual invoice rows).
  // We intentionally ignore column B here: the sheet template has formula/summary
  // rows in column B that extend far below the last real invoice, which caused
  // new data to be written hundreds of rows too low.
  let lastFilledIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const aVal = rows[i][0]?.trim() ?? "";
    if (aVal !== "") lastFilledIndex = i;
  }
  const targetRow = 8 + lastFilledIndex + 1; // 1-indexed sheet row after last filled

  await withRetry(() => sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_TAB}!A${targetRow}:I${targetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  }));

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
    const response = await withRetry(() => sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_TAB}!A:I`,
    }));
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

    const dateParts = parseSheetDateParts(row[0]);
    if (!dateParts) continue;
    const { month: rowMonth, year: rowYear } = dateParts;

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
    log.error({ ctx: "audit-log", msg: "Failed to write audit entry to Sheets", err });
  }
}
