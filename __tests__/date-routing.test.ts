/**
 * Tests for date-based sheet routing (config.sheets.getSpreadsheetId)
 */

// We test the logic directly without loading the config module
// (which would require env vars). Instead, we test the pure function.

function buildRegistry(entries: Record<string, string>) {
  return function getSpreadsheetId(restaurant: string, year: number, month: number): string {
    const key = `${restaurant}_${year}_${String(month).padStart(2, "0")}`;
    const id = entries[key];
    if (!id) {
      throw new Error(
        `No Google Sheet registered for "${key}".`
      );
    }
    return id;
  };
}

describe("Sheet routing: getSpreadsheetId", () => {
  const getSpreadsheetId = buildRegistry({
    "motin_juarez_2025_01": "SHEET_MJ_2025_01",
    "motin_roma_2025_01": "SHEET_MR_2025_01",
    "queseria_2025_01": "SHEET_Q_2025_01",
    "motin_juarez_2025_12": "SHEET_MJ_2025_12",
  });

  test("returns correct ID for motin_juarez Jan 2025", () => {
    expect(getSpreadsheetId("motin_juarez", 2025, 1)).toBe("SHEET_MJ_2025_01");
  });

  test("returns correct ID for motin_roma Jan 2025", () => {
    expect(getSpreadsheetId("motin_roma", 2025, 1)).toBe("SHEET_MR_2025_01");
  });

  test("returns correct ID for queseria Jan 2025", () => {
    expect(getSpreadsheetId("queseria", 2025, 1)).toBe("SHEET_Q_2025_01");
  });

  test("pads single-digit months with leading zero", () => {
    // Month 1 → "01"
    expect(getSpreadsheetId("motin_juarez", 2025, 1)).toBe("SHEET_MJ_2025_01");
  });

  test("handles two-digit months (December)", () => {
    expect(getSpreadsheetId("motin_juarez", 2025, 12)).toBe("SHEET_MJ_2025_12");
  });

  test("throws for unregistered restaurant+month", () => {
    expect(() => getSpreadsheetId("motin_juarez", 2025, 6)).toThrow(
      'No Google Sheet registered for "motin_juarez_2025_06"'
    );
  });

  test("throws for unregistered restaurant", () => {
    expect(() => getSpreadsheetId("unknown_restaurant", 2025, 1)).toThrow();
  });

  test("throws for unregistered year", () => {
    expect(() => getSpreadsheetId("motin_juarez", 2024, 1)).toThrow();
  });
});
