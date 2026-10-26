// UI-safe: no node:* imports — this file is imported by both app.vue (browser) and runtime.
import { defineAttachment } from "@clipbus/plugin-sdk";

export interface CsvPayload {
  kind: "csv_table";
  version: 1;
  delimiter: string;
  headers: string[];
  rows: string[][];
  rowCount: number;
  colCount: number;
  display: {
    typeLabel: string;
    headline: string;
    facts: { label: string; value: string }[];
  };
}

const ATTACHMENT_TYPE = "plugin.formatter.csv";

// Map raw delimiter char to a human-readable label.
function delimiterLabel(delim: string): string {
  if (delim === ",") return "comma";
  if (delim === "\t") return "tab";
  if (delim === ";") return "semicolon";
  return delim;
}

// Parse a single CSV record respecting RFC 4180 quoting.
// Returns an array of field strings.
function parseRecord(line: string, delim: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field
      let field = "";
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            // Escaped quote
            field += '"';
            i += 2;
          } else {
            // Closing quote
            i++;
            break;
          }
        } else {
          field += line[i];
          i++;
        }
      }
      fields.push(field);
      // skip delimiter after closing quote
      if (line[i] === delim) i++;
    } else {
      // Unquoted field: read until delimiter or end
      const start = i;
      while (i < line.length && line[i] !== delim) i++;
      fields.push(line.slice(start, i).trim());
      if (line[i] === delim) i++;
    }
  }
  return fields;
}

interface ParseResult {
  delimiter: string;
  headers: string[];
  rows: string[][];
}

// Parse CSV text. Returns null if content doesn't look like a tabular CSV.
export function parseCsv(text: string): ParseResult | null {
  // Split into non-empty lines
  const allLines = text.split("\n");
  const nonEmptyLines = allLines.filter((l) => l.trim().length > 0);
  if (nonEmptyLines.length < 2) return null;

  // Detect delimiter from the first non-empty line.
  const firstLine = nonEmptyLines[0];
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const semiCount = (firstLine.match(/;/g) ?? []).length;

  let delimiter = ",";
  const maxCount = Math.max(commaCount, tabCount, semiCount);
  if (maxCount === 0) return null; // No delimiters at all — not a CSV
  if (tabCount === maxCount) delimiter = "\t";
  else if (semiCount === maxCount && semiCount > commaCount) delimiter = ";";

  // Parse all non-empty lines into records
  const records = nonEmptyLines.map((line) => parseRecord(line, delimiter));
  const headers = records[0];
  if (headers.length < 2) return null;

  const dataRows = records.slice(1);

  // Majority check: more than half of data rows must match header column count
  const matchingCount = dataRows.filter(
    (row) => row.length === headers.length
  ).length;
  if (matchingCount < dataRows.length / 2) return null;

  return { delimiter, headers, rows: dataRows };
}

export function createCsvPayload(input: unknown): CsvPayload | null {
  const content = (
    input as { content?: { kind?: string; text?: string } } | null
  )?.content;
  if (content?.kind !== "text" || typeof content.text !== "string") return null;

  const parsed = parseCsv(content.text);
  if (!parsed) return null;

  const { delimiter, headers, rows } = parsed;
  const rowCount = rows.length;
  const colCount = headers.length;
  const headline = `${colCount} columns × ${rowCount} rows`;

  return {
    kind: "csv_table",
    version: 1,
    delimiter,
    headers,
    rows,
    rowCount,
    colCount,
    display: {
      typeLabel: "CSV Table",
      headline,
      facts: [
        { label: "Rows", value: String(rowCount) },
        { label: "Columns", value: String(colCount) },
        { label: "Delimiter", value: delimiterLabel(delimiter) },
      ],
    },
  };
}

export function decodeCsvPayload(
  value: unknown
): CsvPayload | null {
  try {
    const p = (typeof value === "string" ? JSON.parse(value) : value ?? {}) as { kind?: string };
    if (p.kind !== "csv_table") return null;
    return p as CsvPayload;
  } catch {
    return null;
  }
}

// Escape pipe characters within a cell for Markdown table syntax.
function escapeCell(cell: string): string {
  return cell.replace(/\|/g, "\\|");
}

// Build a GitHub-flavored Markdown table string from payload.
export function buildMarkdownTable(payload: CsvPayload): string {
  const headerRow = "| " + payload.headers.map(escapeCell).join(" | ") + " |";
  const separatorRow =
    "| " + payload.headers.map(() => "---").join(" | ") + " |";
  const dataRows = payload.rows.map(
    (row) => "| " + row.map(escapeCell).join(" | ") + " |"
  );
  return [headerRow, separatorRow, ...dataRows].join("\n");
}

// Build a JSON array-of-objects from payload. Values stay strings (lossless —
// avoids leading-zero / big-int / locale footguns). Missing cells → "".
// Extra cells beyond headers are ignored. Repeated headers → last value wins
// (Object.fromEntries semantics).
export function buildCsvJson(payload: CsvPayload): string {
  const objects = payload.rows.map((row) =>
    Object.fromEntries(
      payload.headers.map((header, i) => [header, row[i] ?? ""])
    )
  );
  return JSON.stringify(objects, null, 2);
}

export const attachment = defineAttachment<CsvPayload>(ATTACHMENT_TYPE);
