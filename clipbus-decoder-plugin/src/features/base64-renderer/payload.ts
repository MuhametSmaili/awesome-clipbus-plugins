import { defineAttachment } from "@clipbus/plugin-sdk";

export type Base64Encoding = "standard" | "url-safe";

export interface Base64Payload {
  kind: "base64_preview";
  version: 1;
  originalSnippet: string;
  originalLength: number;
  decoded: string;
  decodedLength: number;
  isText: boolean;
  encoding: Base64Encoding;
}

const ATTACHMENT_TYPE = "plugin.decoder.base64";
const MIN_LENGTH = 8;
const MAX_DISPLAY_CHARS = 800;

const BASE64_STANDARD_RE = /^[A-Za-z0-9+/]+=*$/;
const BASE64_URL_SAFE_RE = /^[A-Za-z0-9\-_]+=*$/;
const CONTROL_RE = /\p{C}/u;

function stripWhitespace(s: string): string {
  return s.replace(/\s+/g, "");
}

function detectEncoding(s: string): Base64Encoding | null {
  if (BASE64_STANDARD_RE.test(s)) return "standard";
  if (BASE64_URL_SAFE_RE.test(s)) return "url-safe";
  return null;
}

function isLikelyBase64(stripped: string): boolean {
  // Has classic base64 markers (+ / =) → strong signal
  if (/[+/=]/.test(stripped)) return true;
  // Has URL-safe markers (- _) → strong signal
  if (/[-_]/.test(stripped)) return true;
  // Pure alphanumeric: require longer string divisible by 4 to reduce false positives
  return stripped.length >= 24 && stripped.length % 4 === 0;
}

function tryDecode(stripped: string, encoding: Base64Encoding): string | null {
  try {
    let b64 = stripped;
    if (encoding === "url-safe") {
      b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
    }
    const remainder = b64.length % 4;
    if (remainder === 2) b64 += "==";
    else if (remainder === 3) b64 += "=";
    else if (remainder === 1) return null;

    const bytes = Buffer.from(b64, "base64");
    if (bytes.length === 0) return null;
    const decoded = bytes.toString("utf-8");
    if (!Buffer.from(decoded, "utf-8").equals(bytes)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function looksLikeText(s: string): boolean {
  let printable = 0;
  let total = 0;
  for (const char of s) {
    total += 1;
    if (char === "\t" || char === "\n" || char === "\r" || !CONTROL_RE.test(char)) {
      printable += 1;
    }
  }
  return total > 0 && printable / total >= 0.95;
}

export function createBase64Payload(input: unknown): Base64Payload | null {
  const content = (input as { content?: { kind?: string; text?: string } } | null)?.content;
  if (content?.kind !== "text" || typeof content.text !== "string") return null;

  const raw = content.text.trim();
  const stripped = stripWhitespace(raw);

  if (stripped.length < MIN_LENGTH) return null;

  const encoding = detectEncoding(stripped);
  if (!encoding) return null;
  if (!isLikelyBase64(stripped)) return null;

  const decoded = tryDecode(stripped, encoding);
  if (!decoded) return null;

  const isText = looksLikeText(decoded);
  if (!isText) return null;

  return {
    kind: "base64_preview",
    version: 1,
    originalSnippet: raw.length > 80 ? raw.slice(0, 80) + "…" : raw,
    originalLength: stripped.length,
    decoded: decoded.length > MAX_DISPLAY_CHARS ? decoded.slice(0, MAX_DISPLAY_CHARS) + "…" : decoded,
    decodedLength: decoded.length,
    isText,
    encoding,
  };
}

export function decodeBase64Payload(value: unknown): Base64Payload | null {
  try {
    const p = (typeof value === "string" ? JSON.parse(value) : value ?? {}) as { kind?: string };
    if (p.kind !== "base64_preview") return null;
    return p as Base64Payload;
  } catch {
    return null;
  }
}

export const attachment = defineAttachment<Base64Payload>(ATTACHMENT_TYPE);
