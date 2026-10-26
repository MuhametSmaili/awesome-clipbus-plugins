import { defineAttachment } from "@clipbus/plugin-sdk";

export const ATTACHMENT_TYPE = "plugin.extractor.uuid" as const;

// ── Payload shape ─────────────────────────────────────────────────────────────

export interface UuidPayload {
  kind: "uuid_details";
  version: 1;
  input: string;
  canonical: string;
  urn: string;
  uuidVersion: number;
  versionLabel: string;
  special: "Nil UUID" | "Max UUID" | null;
  variant: "RFC 4122/9562" | "NCS (legacy)" | "Microsoft (legacy)" | "Reserved";
  timestamp: string | null;
  node: string | null;
}

// ── UUID regex ────────────────────────────────────────────────────────────────

/**
 * Matches optional brace wrapper, optional urn:uuid: prefix, then exactly
 * 8-4-4-4-12 hex groups separated by hyphens. Case-insensitive.
 * Capturing groups 1-5 hold the five hyphen-delimited hex groups.
 */
const UUID_RE =
  /^\{?(?:urn:uuid:)?([0-9a-fA-F]{8})-([0-9a-fA-F]{4})-([0-9a-fA-F]{4})-([0-9a-fA-F]{4})-([0-9a-fA-F]{12})\}?$/i;

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapVersion(nibble: number): string {
  switch (nibble) {
    case 1: return "Time-based (v1)";
    case 2: return "DCE Security (v2)";
    case 3: return "Name-based MD5 (v3)";
    case 4: return "Random (v4)";
    case 5: return "Name-based SHA-1 (v5)";
    case 6: return "Reordered time (v6)";
    case 7: return "Unix-time (v7)";
    case 8: return "Custom (v8)";
    default: return `Unknown (v${nibble})`;
  }
}

function mapVariant(nibble: number): UuidPayload["variant"] {
  if (nibble >= 0xe) return "Reserved";
  if (nibble >= 0xc) return "Microsoft (legacy)";
  if (nibble >= 0x8) return "RFC 4122/9562";
  return "NCS (legacy)";
}

/**
 * Decode the 60-bit Gregorian timestamp embedded in a v1 UUID.
 * Uses BigInt to avoid precision loss on 60-bit values.
 * 100-ns-since-1582-10-15 → Unix ms via: unixMs = ts/10000 − 12219292800000.
 */
function decodeV1Timestamp(groups: string[]): string {
  const timeLow = BigInt("0x" + groups[0]);
  const timeMid = BigInt("0x" + groups[1]);
  const timeHi = BigInt("0x" + groups[2]) & 0x0fffn; // strip version nibble
  const ts = (timeHi << 48n) | (timeMid << 32n) | timeLow;
  const unixMs = Number(ts / 10000n - 12219292800000n);
  return new Date(unixMs).toISOString();
}

/**
 * Decode the 48-bit Unix-ms timestamp embedded in a v7 UUID.
 * The first 12 hex digits (group1 + group2) are the millisecond count.
 * 48 bits < 2^53, so a plain parseInt is safe without BigInt.
 */
function decodeV7Timestamp(groups: string[]): string {
  const ms = parseInt(groups[0] + groups[1], 16);
  return new Date(ms).toISOString();
}

/** Format 12 contiguous hex chars as a MAC-style XX:XX:XX:XX:XX:XX string. */
function formatNode(group5: string): string {
  return (group5.match(/.{2}/g) as string[]).join(":");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a UuidPayload from a detector input object.
 * Pure JS — no node:* imports; safe for both UI and runtime.
 * Returns null when the content is not a single valid UUID.
 */
export function createUuidPayload(input: unknown): UuidPayload | null {
  const content = (
    input as { content?: { kind?: string; text?: string } } | null
  )?.content;
  if (content?.kind !== "text" || typeof content.text !== "string") return null;

  const text = content.text.trim();
  if (!text) return null;

  const m = UUID_RE.exec(text);
  if (!m) return null;

  const canonical = [m[1], m[2], m[3], m[4], m[5]].join("-").toLowerCase();
  const groups = canonical.split("-");

  const versionNibble = parseInt(groups[2][0], 16);
  const variantNibble = parseInt(groups[3][0], 16);

  // Detect special cases (Nil = all zeros, Max = all fs)
  const allHex = canonical.replace(/-/g, "");
  let special: UuidPayload["special"] = null;
  if (allHex === "0".repeat(32)) special = "Nil UUID";
  else if (allHex === "f".repeat(32)) special = "Max UUID";

  // Embedded timestamp (v1 and v7 only)
  let timestamp: string | null = null;
  if (versionNibble === 1) {
    timestamp = decodeV1Timestamp(groups);
  } else if (versionNibble === 7) {
    timestamp = decodeV7Timestamp(groups);
  }

  // Node address (v1 only): last 12 hex digits as MAC-style notation
  const node = versionNibble === 1 ? formatNode(groups[4]) : null;

  return {
    kind: "uuid_details",
    version: 1,
    input: text,
    canonical,
    urn: "urn:uuid:" + canonical,
    uuidVersion: versionNibble,
    versionLabel: mapVersion(versionNibble),
    special,
    variant: mapVariant(variantNibble),
    timestamp,
    node,
  };
}

/**
 * Decode a structured payload or a serialized payload.
 * Returns null for missing or malformed data.
 */
export function decodeUuidPayload(
  value: unknown
): UuidPayload | null {
  try {
    const p = (typeof value === "string" ? JSON.parse(value) : value) as { kind?: string };
    if (!p || typeof p !== "object" || p.kind !== "uuid_details") return null;
    return p as UuidPayload;
  } catch {
    return null;
  }
}

export const attachment = defineAttachment<UuidPayload>(ATTACHMENT_TYPE);
