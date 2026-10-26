import { defineAttachment } from "@clipbus/plugin-sdk";

export const ATTACHMENT_TYPE = "plugin.extractor.mac" as const;

// ── Payload shape ─────────────────────────────────────────────────────────────

export interface MacPayload {
  kind: "mac_address";
  version: 1;
  input: string;
  /** Six octets as numbers 0–255. */
  octets: number[];
  // Normalized forms
  colonLower: string;  // 00:1a:2b:3c:4d:5e
  colonUpper: string;  // 00:1A:2B:3C:4D:5E
  hyphen: string;      // 00-1A-2B-3C-4D-5E
  ciscoDot: string;    // 001A.2B3C.4D5E
  bare: string;        // 001a2b3c4d5e
  // Structural split
  oui: string;         // first 3 octets upper-colon, e.g. "00:1A:2B"
  nic: string;         // last  3 octets upper-colon, e.g. "3C:4D:5E"
  // Bit-flag interpretations
  cast: "Unicast (individual)" | "Multicast (group)";
  administration: "Universal (OUI/vendor-assigned)" | "Locally administered";
  // Broadcast / null special label (null when neither applies)
  special: "Broadcast" | "Null address" | null;
}

// ── Parsing ───────────────────────────────────────────────────────────────────

/**
 * Try to parse a trimmed MAC string into exactly 6 octets.
 * Accepted formats (separator required — bare 12-hex is rejected):
 *   Colon:     XX:XX:XX:XX:XX:XX  (6 groups of 2 hex, ':')
 *   Hyphen:    XX-XX-XX-XX-XX-XX  (6 groups of 2 hex, '-')
 *   Cisco dot: XXXX.XXXX.XXXX     (3 groups of 4 hex, '.')
 * Returns null for everything else (bare, wrong group count, non-hex, mixed).
 */
function parseMacOctets(text: string): number[] | null {
  // Colon: exactly 6 groups of 2 hex
  if (/^[0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5}$/.test(text)) {
    return text.split(":").map((g) => parseInt(g, 16));
  }
  // Hyphen: exactly 6 groups of 2 hex
  if (/^[0-9a-fA-F]{2}(?:-[0-9a-fA-F]{2}){5}$/.test(text)) {
    return text.split("-").map((g) => parseInt(g, 16));
  }
  // Cisco dot: exactly 3 groups of 4 hex
  if (/^[0-9a-fA-F]{4}(?:\.[0-9a-fA-F]{4}){2}$/.test(text)) {
    const octets: number[] = [];
    for (const g of text.split(".")) {
      octets.push(parseInt(g.slice(0, 2), 16));
      octets.push(parseInt(g.slice(2, 4), 16));
    }
    return octets;
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a MacPayload from a detector input object.
 * Pure JS — no node:* imports; safe for both UI and runtime.
 * Returns null when the content is not a single valid MAC address.
 */
export function createMacPayload(input: unknown): MacPayload | null {
  const content = (
    input as { content?: { kind?: string; text?: string } } | null
  )?.content;
  if (content?.kind !== "text" || typeof content.text !== "string") return null;

  const text = content.text.trim();
  if (!text) return null;

  const o = parseMacOctets(text);
  if (!o) return null;

  const hex2lo = (n: number) => n.toString(16).padStart(2, "0");
  const hex2up = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  const hex4up = (hi: number, lo: number) => hex2up(hi) + hex2up(lo);

  const colonLower = o.map(hex2lo).join(":");
  const colonUpper = o.map(hex2up).join(":");
  const hyphen = o.map(hex2up).join("-");
  const ciscoDot =
    hex4up(o[0], o[1]) + "." + hex4up(o[2], o[3]) + "." + hex4up(o[4], o[5]);
  const bare = o.map(hex2lo).join("");

  const oui = [o[0], o[1], o[2]].map(hex2up).join(":");
  const nic = [o[3], o[4], o[5]].map(hex2up).join(":");

  // I/G bit (bit 0 of first octet): 0 = individual/unicast, 1 = group/multicast
  const cast: MacPayload["cast"] =
    (o[0] & 0x01) === 0 ? "Unicast (individual)" : "Multicast (group)";

  // U/L bit (bit 1 of first octet): 0 = universally administered, 1 = locally administered
  const administration: MacPayload["administration"] =
    (o[0] & 0x02) === 0
      ? "Universal (OUI/vendor-assigned)"
      : "Locally administered";

  let special: MacPayload["special"] = null;
  if (o.every((x) => x === 0xff)) special = "Broadcast";
  else if (o.every((x) => x === 0x00)) special = "Null address";

  return {
    kind: "mac_address",
    version: 1,
    input: text,
    octets: o,
    colonLower,
    colonUpper,
    hyphen,
    ciscoDot,
    bare,
    oui,
    nic,
    cast,
    administration,
    special,
  };
}

/**
 * Decode a structured payload or a serialized payload.
 * Returns null for missing or malformed data.
 */
export function decodeMacPayload(
  value: unknown
): MacPayload | null {
  try {
    const p = (typeof value === "string" ? JSON.parse(value) : value) as { kind?: string };
    if (!p || typeof p !== "object" || p.kind !== "mac_address") return null;
    return p as MacPayload;
  } catch {
    return null;
  }
}

export const attachment = defineAttachment<MacPayload>(ATTACHMENT_TYPE);
