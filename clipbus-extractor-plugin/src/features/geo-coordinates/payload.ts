import { defineAttachment } from "@clipbus/plugin-sdk";

export const ATTACHMENT_TYPE = "plugin.extractor.geo" as const;

// ── Payload shape ─────────────────────────────────────────────────────────────

export interface GeoPayload {
  kind: "geo_coordinates";
  version: 1;
  input: string;
  lat: number;
  lng: number;
  decimal: string;
  latDms: string;
  lngDms: string;
  hemisphere: string;
  osmUrl: string;
  googleUrl: string;
}

// ── DMS conversion ────────────────────────────────────────────────────────────

/** Convert a signed decimal degree to a DMS string with 1-decimal seconds. */
function toDms(decimal: number, isLat: boolean): string {
  const abs = Math.abs(decimal);
  let d = Math.floor(abs);
  const mFull = (abs - d) * 60;
  let m = Math.floor(mFull);
  // Round seconds to 1 decimal, then carry 60" -> 1' and 60' -> 1° so we never
  // emit an invalid component like 60.0" (e.g. 10.999999° -> 11°0'0.0"N).
  let s = Math.round((mFull - m) * 60 * 10) / 10;
  if (s >= 60) {
    s -= 60;
    m += 1;
  }
  if (m >= 60) {
    m -= 60;
    d += 1;
  }
  const hemi = isLat
    ? decimal >= 0
      ? "N"
      : "S"
    : decimal >= 0
      ? "E"
      : "W";
  return `${d}°${m}'${s.toFixed(1)}"${hemi}`;
}

// ── Regex + parser ────────────────────────────────────────────────────────────

// Matches exactly two decimal numbers with optional degree sign and hemisphere.
// Group 1: first number (with optional ± sign)
// Group 2: first hemisphere letter (N/S — latitude side)
// Group 3: second number (with optional ± sign)
// Group 4: second hemisphere letter (E/W — longitude side)
const GEO_RE =
  /^([+-]?\d+(?:\.\d+)?)\s*°?\s*([NSns])?\s*[,\s]+\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*([EWew])?$/;

/**
 * Parse and validate a geo coordinate string.
 * Returns { lat, lng } on success or null on failure.
 *
 * Accepted forms (whole trimmed string, nothing else):
 *   "37.7749, -122.4194"  "37.7749,-122.4194"  "37.7749 -122.4194"
 *   "37.7749° N, 122.4194° W"  "37.7749N 122.4194W"
 *
 * False-positive guard: at least one of the two numbers must contain a decimal
 * point, OR a hemisphere letter must appear, OR a degree sign must be present —
 * so bare integer pairs like "1, 2" or "404, 500" are rejected.
 *
 * If a hemisphere letter is present the numeric part must be non-negative
 * (reject contradictory signs like "-37.7 N"). S/W fold into a negative value.
 *
 * Pure JS — no node:* imports; safe for both UI and runtime.
 */
export function parseGeoCoordinates(
  raw: string
): { lat: number; lng: number } | null {
  const text = raw.trim();
  if (!text) return null;

  const match = GEO_RE.exec(text);
  if (!match) return null;

  const [, num1Str, hemi1Raw, num2Str, hemi2Raw] = match;
  const hemi1 = hemi1Raw?.toUpperCase() as "N" | "S" | undefined;
  const hemi2 = hemi2Raw?.toUpperCase() as "E" | "W" | undefined;

  const num1 = parseFloat(num1Str);
  const num2 = parseFloat(num2Str);

  // False-positive guard — reject bare integer pairs (e.g. "1, 2", "404, 500").
  const hasDecimal = num1Str.includes(".") || num2Str.includes(".");
  const hasHemisphere = hemi1 !== undefined || hemi2 !== undefined;
  const hasDegreeSign = text.includes("°");
  if (!hasDecimal && !hasHemisphere && !hasDegreeSign) return null;

  // Fold hemisphere into sign; reject contradictory combinations (e.g. "-37.7 N").
  let lat: number;
  let lng: number;

  if (hemi1 !== undefined) {
    if (num1 < 0) return null; // sign contradicts hemisphere
    lat = hemi1 === "S" ? -num1 : num1;
  } else {
    lat = num1;
  }

  if (hemi2 !== undefined) {
    if (num2 < 0) return null; // sign contradicts hemisphere
    lng = hemi2 === "W" ? -num2 : num2;
  } else {
    lng = num2;
  }

  // Range validation — latitude ∈ [-90, 90], longitude ∈ [-180, 180].
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;

  return { lat, lng };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a GeoPayload from a detector input object.
 * Returns null when content is not a single valid coordinate pair.
 */
export function createGeoPayload(input: unknown): GeoPayload | null {
  const content = (
    input as { content?: { kind?: string; text?: string } } | null
  )?.content;
  if (content?.kind !== "text" || typeof content.text !== "string") return null;

  const result = parseGeoCoordinates(content.text);
  if (!result) return null;

  const { lat, lng } = result;

  const decimal = `${lat}, ${lng}`;
  const latDms = toDms(lat, true);
  const lngDms = toDms(lng, false);
  const hemisphere = `${lat >= 0 ? "N" : "S"} / ${lng >= 0 ? "E" : "W"}`;

  const osmUrl =
    `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=12/${lat}/${lng}`;
  const googleUrl = `https://maps.google.com/?q=${lat},${lng}`;

  return {
    kind: "geo_coordinates",
    version: 1,
    input: content.text.trim(),
    lat,
    lng,
    decimal,
    latDms,
    lngDms,
    hemisphere,
    osmUrl,
    googleUrl,
  };
}

/**
 * Decode a structured payload or a serialized payload.
 * Returns null for missing or malformed data.
 */
export function decodeGeoPayload(
  value: unknown
): GeoPayload | null {
  try {
    const p = (typeof value === "string" ? JSON.parse(value) : value) as { kind?: string };
    if (!p || typeof p !== "object" || p.kind !== "geo_coordinates") return null;
    return p as GeoPayload;
  } catch {
    return null;
  }
}

export const attachment = defineAttachment<GeoPayload>(ATTACHMENT_TYPE);
