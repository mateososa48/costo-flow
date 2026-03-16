/**
 * Convert an array of objects to a CSV string.
 * Handles quoting for fields that contain commas, quotes, or newlines.
 */
export function toCSV(
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[]
): string {
  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => escape(row[c.key])).join(",")
  );

  return [header, ...body].join("\n");
}
