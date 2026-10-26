import { defineAttachment } from "@clipbus/plugin-sdk";

export interface FilesizeUnit {
  unit: string;
  value: string;
}

export interface FilesizePayload {
  kind: "filesize_preview";
  version: 1;
  input: string;
  bytes: number;
  bytesFormatted: string;
  siUnits: FilesizeUnit[];
  iecUnits: FilesizeUnit[];
  naturalSI: FilesizeUnit;
  naturalIEC: FilesizeUnit;
}

const ATTACHMENT_TYPE = "plugin.converter.filesize";

const SIZE_RE =
  /^\s*([\d,]+(?:\.\d+)?)\s*(B|bytes?|KB|MB|GB|TB|PB|KiB|MiB|GiB|TiB|PiB)\s*$/i;

// SI (decimal, base-1000) factors
const SI_FACTORS: { unit: string; factor: number }[] = [
  { unit: "B",  factor: 1 },
  { unit: "KB", factor: 1e3 },
  { unit: "MB", factor: 1e6 },
  { unit: "GB", factor: 1e9 },
  { unit: "TB", factor: 1e12 },
  { unit: "PB", factor: 1e15 },
];

// IEC (binary, base-1024) factors
const IEC_FACTORS: { unit: string; factor: number }[] = [
  { unit: "B",   factor: 1 },
  { unit: "KiB", factor: 1024 },
  { unit: "MiB", factor: 1024 ** 2 },
  { unit: "GiB", factor: 1024 ** 3 },
  { unit: "TiB", factor: 1024 ** 4 },
  { unit: "PiB", factor: 1024 ** 5 },
];

/** Normalise a unit string to its canonical uppercase form used in the factor tables. */
function normaliseUnit(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower === "b" || lower === "byte" || lower === "bytes") return "B";
  // KiB, MiB, GiB, TiB, PiB — preserve original casing after first char
  if (/^[kmgtp]ib$/i.test(raw)) {
    return raw.charAt(0).toUpperCase() + "iB";
  }
  // KB, MB, GB, TB, PB
  return raw.toUpperCase();
}

/** Format a floating-point value to up to 4 significant figures, trimming trailing zeros. */
function formatValue(value: number): string {
  if (value === 0) return "0";
  // For whole numbers don't add decimal noise
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  // Use toPrecision for significant figures, then strip trailing zeros
  const s = parseFloat(value.toPrecision(4)).toString();
  return s;
}

/** Format an integer byte count with comma thousands separators. */
function formatBytes(n: number): string {
  return n.toLocaleString("en-US");
}

/** Build a ladder of unit conversions, picking entries where value >= 1. */
function buildLadder(
  bytes: number,
  table: { unit: string; factor: number }[]
): FilesizeUnit[] {
  return table.map(({ unit, factor }) => ({
    unit,
    value: formatValue(bytes / factor),
  }));
}

/** Find the largest unit whose value is >= 1 (the most natural representation). */
function naturalUnit(
  bytes: number,
  table: { unit: string; factor: number }[]
): FilesizeUnit {
  let best = table[0];
  for (const entry of table) {
    if (bytes / entry.factor >= 1) best = entry;
  }
  return { unit: best.unit, value: formatValue(bytes / best.factor) };
}

export function parseSize(text: string): { bytes: number; input: string } | null {
  const m = text.match(SIZE_RE);
  if (!m) return null;
  const numStr = m[1].replace(/,/g, "");
  const rawUnit = m[2];
  const num = parseFloat(numStr);
  if (!isFinite(num) || num < 0) return null;

  const canon = normaliseUnit(rawUnit);

  const siEntry = SI_FACTORS.find((e) => e.unit === canon);
  const iecEntry = IEC_FACTORS.find((e) => e.unit === canon);
  const factor = siEntry?.factor ?? iecEntry?.factor ?? null;
  if (factor === null) return null;

  const bytes = Math.round(num * factor);
  return { bytes, input: text.trim() };
}

export function createFilesizePayload(input: unknown): FilesizePayload | null {
  const content = (input as { content?: { kind?: string; text?: string } } | null)?.content;
  if (content?.kind !== "text" || typeof content.text !== "string") return null;

  const parsed = parseSize(content.text);
  if (!parsed) return null;

  const { bytes, input: originalInput } = parsed;
  return {
    kind: "filesize_preview",
    version: 1,
    input: originalInput,
    bytes,
    bytesFormatted: formatBytes(bytes),
    siUnits: buildLadder(bytes, SI_FACTORS),
    iecUnits: buildLadder(bytes, IEC_FACTORS),
    naturalSI: naturalUnit(bytes, SI_FACTORS),
    naturalIEC: naturalUnit(bytes, IEC_FACTORS),
  };
}

export function decodeFilesizePayload(
  value: unknown
): FilesizePayload | null {
  try {
    const p = (typeof value === "string" ? JSON.parse(value) : value ?? {}) as { kind?: string };
    if (p.kind !== "filesize_preview") return null;
    return p as FilesizePayload;
  } catch {
    return null;
  }
}

export const attachment = defineAttachment<FilesizePayload>(ATTACHMENT_TYPE);
