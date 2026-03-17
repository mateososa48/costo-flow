/**
 * POST /api/admin/backfill
 *
 * One-time utility: reads every row from every Google Sheet in SHEET_REGISTRY,
 * checks whether each row already exists in Supabase, and inserts the missing ones.
 *
 * Query params:
 *   ?dry=true  — preview only, no writes (default: false)
 *
 * Returns:
 *   { inserted, skipped, errors, rows }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { config } from "@/config";
import getSupabase from "@/lib/supabase";
import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";

const SHEET_TAB = "Informe de Gastos";

function getAuth() {
  return new google.auth.JWT({
    email: config.google.serviceAccountEmail,
    key: config.google.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

/** Parse dd/mm/yyyy → yyyy-mm-dd */
function sheetDateToISO(d: string): string | null {
  if (!d) return null;
  const parts = d.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  if (!day || !month || !year) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** Parse a Spanish-locale number string (comma decimal) → number */
function parseNum(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(",", ".")) || 0;
}

/** Extract restaurant slug from a SHEET_REGISTRY key like "motin_juarez_2026_01" */
function restaurantFromKey(key: string): string {
  // Key format: {restaurant}_{YYYY}_{MM}
  // Restaurant slugs: motin_juarez, motin_roma, queseria
  const known = ["motin_juarez", "motin_roma", "queseria"];
  for (const r of known) {
    if (key.startsWith(r)) return r;
  }
  // Fallback: everything before the last two _segments
  const parts = key.split("_");
  return parts.slice(0, -2).join("_");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dry = request.nextUrl.searchParams.get("dry") === "true";

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let registry: Record<string, string>;
  try {
    registry = config.sheets.registry;
  } catch (err) {
    return NextResponse.json({ error: `SHEET_REGISTRY error: ${err instanceof Error ? err.message : err}` }, { status: 500 });
  }

  const sheets = google.sheets({ version: "v4", auth: getAuth() });

  const diagnostics: { key: string; spreadsheetId: string; restaurant: string; rawRowCount: number; parsedRows: number; firstRawRow?: string[] }[] = [];

  const summary: {
    key: string;
    spreadsheetId: string;
    restaurant: string;
    row: number;
    date: string;
    supplier: string;
    total: number;
    action: "inserted" | "skipped" | "error";
    reason?: string;
  }[] = [];

  for (const [key, spreadsheetId] of Object.entries(registry)) {
    const restaurant = restaurantFromKey(key);

    let rows: string[][];
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SHEET_TAB}!A8:I`,
      });
      rows = (res.data.values ?? []) as string[][];
    } catch (err) {
      summary.push({
        key, spreadsheetId, restaurant,
        row: 0, date: "", supplier: "", total: 0,
        action: "error",
        reason: `Failed to read sheet: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    let parsedRows = 0;
    diagnostics.push({ key, spreadsheetId, restaurant, rawRowCount: rows.length, parsedRows: 0, firstRawRow: rows[0] });
    const diagEntry = diagnostics[diagnostics.length - 1];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rawDate = r[0]?.trim() ?? "";
      const supplier = r[1]?.trim() ?? "";
      if (!rawDate || !supplier) continue; // skip empty / header rows

      const invoiceDate = sheetDateToISO(rawDate);
      if (!invoiceDate) continue;
      parsedRows++; diagEntry.parsedRows = parsedRows;

      const invoiceNumber = r[2]?.trim() ?? null;
      const importe = parseNum(r[3] ?? "");
      const iva = parseNum(r[4] ?? "");
      const total = parseNum(r[5] ?? "");
      const concepto = r[6]?.trim() ?? "";
      const cuentaPnl = r[7]?.trim() ?? "";
      const comments = r[8]?.trim() ?? "";
      const sheetRow = 8 + i; // 1-indexed sheet row number

      if (!total) continue; // skip rows without a total

      // Check if already in Supabase (match on restaurant + date + supplier + total)
      const { data: existing } = await supabase
        .from("invoices")
        .select("id")
        .eq("restaurant", restaurant)
        .eq("invoice_date", invoiceDate)
        .ilike("supplier", supplier)
        .gte("total", total - 0.01)
        .lte("total", total + 0.01)
        .limit(1);

      if (existing && existing.length > 0) {
        summary.push({ key, spreadsheetId, restaurant, row: sheetRow, date: invoiceDate, supplier, total, action: "skipped" });
        continue;
      }

      if (dry) {
        summary.push({ key, spreadsheetId, restaurant, row: sheetRow, date: invoiceDate, supplier, total, action: "inserted", reason: "dry run" });
        continue;
      }

      // Insert into Supabase
      const { error: insertError } = await supabase.from("invoices").insert({
        id: uuidv4(),
        restaurant,
        supplier,
        invoice_number: invoiceNumber || null,
        invoice_date: invoiceDate,
        importe,
        iva,
        total,
        concepto: concepto || null,
        cuenta_pnl: cuentaPnl || null,
        comments: comments || null,
        submitted_by: "backfill",
        spreadsheet_url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      });

      if (insertError) {
        summary.push({ key, spreadsheetId, restaurant, row: sheetRow, date: invoiceDate, supplier, total, action: "error", reason: insertError.message });
      } else {
        summary.push({ key, spreadsheetId, restaurant, row: sheetRow, date: invoiceDate, supplier, total, action: "inserted" });
      }
    }
  }

  const inserted = summary.filter((s) => s.action === "inserted").length;
  const skipped = summary.filter((s) => s.action === "skipped").length;
  const errors = summary.filter((s) => s.action === "error");

  return NextResponse.json({ dry, inserted, skipped, errorCount: errors.length, errors, diagnostics, rows: summary });
}
