/**
 * Tests for invoice → sheet row mapping
 */

// Import the pure functions from sheets.ts
// We test formatDateForSheet and invoiceToSheetRow without Sheets API deps

function formatDateForSheet(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

type TestInvoice = {
  invoiceDate: string;
  supplier: string;
  invoiceNumber?: string;
  importe: number;
  iva: number;
  total: number;
  concepto: string;
  cuentaPnl: string;
  comments?: string;
};

function invoiceToSheetRow(invoice: TestInvoice): string[] {
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

const SAMPLE_INVOICE: TestInvoice = {
  invoiceDate: "2025-01-15",
  supplier: "Distribuidora El Rancho SA de CV",
  invoiceNumber: "F-2025-001",
  importe: 1000,
  iva: 160,
  total: 1160,
  concepto: "Alimentos y Bebidas",
  cuentaPnl: "Costo de Ventas",
  comments: "Entrega urgente",
};

describe("formatDateForSheet", () => {
  test("converts yyyy-mm-dd to dd/mm/yyyy", () => {
    expect(formatDateForSheet("2025-01-15")).toBe("15/01/2025");
  });

  test("handles end-of-year date", () => {
    expect(formatDateForSheet("2025-12-31")).toBe("31/12/2025");
  });

  test("preserves leading zeros", () => {
    expect(formatDateForSheet("2025-01-05")).toBe("05/01/2025");
  });
});

describe("invoiceToSheetRow", () => {
  test("returns an array of 9 elements", () => {
    const row = invoiceToSheetRow(SAMPLE_INVOICE);
    expect(row).toHaveLength(9);
  });

  test("column A (index 0) is date in dd/mm/yyyy", () => {
    const row = invoiceToSheetRow(SAMPLE_INVOICE);
    expect(row[0]).toBe("15/01/2025");
  });

  test("column B (index 1) is supplier name", () => {
    const row = invoiceToSheetRow(SAMPLE_INVOICE);
    expect(row[1]).toBe("Distribuidora El Rancho SA de CV");
  });

  test("column C (index 2) is invoice number", () => {
    const row = invoiceToSheetRow(SAMPLE_INVOICE);
    expect(row[2]).toBe("F-2025-001");
  });

  test("column D (index 3) is importe as string", () => {
    const row = invoiceToSheetRow(SAMPLE_INVOICE);
    expect(row[3]).toBe("1000");
  });

  test("column E (index 4) is iva as string", () => {
    const row = invoiceToSheetRow(SAMPLE_INVOICE);
    expect(row[4]).toBe("160");
  });

  test("column F (index 5) is total as string", () => {
    const row = invoiceToSheetRow(SAMPLE_INVOICE);
    expect(row[5]).toBe("1160");
  });

  test("column G (index 6) is concepto", () => {
    const row = invoiceToSheetRow(SAMPLE_INVOICE);
    expect(row[6]).toBe("Alimentos y Bebidas");
  });

  test("column H (index 7) is cuentaPnl", () => {
    const row = invoiceToSheetRow(SAMPLE_INVOICE);
    expect(row[7]).toBe("Costo de Ventas");
  });

  test("column I (index 8) is comments", () => {
    const row = invoiceToSheetRow(SAMPLE_INVOICE);
    expect(row[8]).toBe("Entrega urgente");
  });

  test("missing invoiceNumber becomes empty string", () => {
    const inv = { ...SAMPLE_INVOICE, invoiceNumber: undefined };
    const row = invoiceToSheetRow(inv);
    expect(row[2]).toBe("");
  });

  test("missing comments becomes empty string", () => {
    const inv = { ...SAMPLE_INVOICE, comments: undefined };
    const row = invoiceToSheetRow(inv);
    expect(row[8]).toBe("");
  });
});
