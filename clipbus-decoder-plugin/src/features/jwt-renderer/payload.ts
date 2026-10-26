// payload.ts — UI-safe single source of truth for the JWT preview attachment.
// NO `import … from "node:*"` here: this file is imported by app.vue (browser) too.
// `Buffer` is used inline only inside createJwtPayload (runtime/test code paths),
// never executed in the browser — that is allowed (it is a global, not an import).

import { defineAttachment } from "@clipbus/plugin-sdk";

const ATTACHMENT_TYPE = "plugin.decoder.jwt";

export interface JwtFact {
  label: string;
  value: string;
}

export interface JwtPayload {
  kind: "jwt_preview";
  version: 1;
  alg: string;
  typ: string;
  headerPretty: string;
  payloadPretty: string;
  claimFacts: JwtFact[];
  expIso: string | null;
  isExpired: boolean | null;
  relativeLabel: string | null;
  signaturePresent: boolean;
}

// header.payload.signature — each segment is base64url; signature may be empty (alg=none).
const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;

const MAX_VALUE_CHARS = 96;

function base64UrlToObject(seg: string): Record<string, unknown> | null {
  try {
    let b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const remainder = b64.length % 4;
    if (remainder === 2) b64 += "==";
    else if (remainder === 3) b64 += "=";
    else if (remainder === 1) return null;

    const text = Buffer.from(b64, "base64").toString("utf-8");
    const obj = JSON.parse(text);
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return null;
    return obj as Record<string, unknown>;
  } catch {
    return null;
  }
}

function pretty(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return "{}";
  }
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function clamp(value: string): string {
  return value.length > MAX_VALUE_CHARS ? value.slice(0, MAX_VALUE_CHARS) + "…" : value;
}

function unixToIso(seconds: unknown): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  try {
    return new Date(seconds * 1000).toISOString().replace(/\.000Z$/, "Z");
  } catch {
    return null;
  }
}

function relativeLabel(expSeconds: number, nowMs: number): string {
  const deltaMs = expSeconds * 1000 - nowMs;
  const past = deltaMs < 0;
  const seconds = Math.abs(deltaMs) / 1000;
  const units: Array<[number, string]> = [
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
    [1, "second"],
  ];
  let label = "0 seconds";
  for (const [size, name] of units) {
    if (seconds >= size) {
      const count = Math.floor(seconds / size);
      label = `${count} ${name}${count === 1 ? "" : "s"}`;
      break;
    }
  }
  return past ? `Expired ${label} ago` : `Expires in ${label}`;
}

const CLAIM_LABELS: Record<string, string> = {
  iss: "Issuer (iss)",
  sub: "Subject (sub)",
  aud: "Audience (aud)",
  azp: "Authorized party (azp)",
  scope: "Scope (scope)",
  name: "name",
  email: "email",
  jti: "JWT ID (jti)",
};

const STRING_CLAIM_ORDER = ["iss", "sub", "aud", "azp", "scope", "name", "email", "jti"];

export function createJwtPayload(input: unknown): JwtPayload | null {
  const content = (input as { content?: { kind?: string; text?: string } } | null)?.content;
  if (content?.kind !== "text" || typeof content.text !== "string") return null;

  const raw = content.text.trim();
  if (!JWT_RE.test(raw)) return null;

  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [headerSeg, payloadSeg, signatureSeg] = parts;
  if (headerSeg.length < 2 || payloadSeg.length < 2) return null;

  const header = base64UrlToObject(headerSeg);
  const claims = base64UrlToObject(payloadSeg);
  if (!header || !claims) return null;

  // Require a real JWT header to avoid matching arbitrary dotted base64url strings.
  if (typeof header.alg !== "string") return null;

  const alg = asString(header.alg) || "?";
  const typ = asString(header.typ) || "JWT";

  const claimFacts: JwtFact[] = [];
  for (const key of STRING_CLAIM_ORDER) {
    if (key in claims) {
      const value = asString(claims[key]);
      if (value) claimFacts.push({ label: CLAIM_LABELS[key] ?? key, value: clamp(value) });
    }
  }

  const nowMs = Date.now();
  const expSeconds = typeof claims.exp === "number" ? claims.exp : null;
  let expIso: string | null = null;
  let isExpired: boolean | null = null;
  let relLabel: string | null = null;
  if (expSeconds !== null) {
    expIso = unixToIso(expSeconds);
    isExpired = expSeconds * 1000 < nowMs;
    relLabel = relativeLabel(expSeconds, nowMs);
  }
  if (typeof claims.iat === "number") {
    claimFacts.push({ label: "Issued at (iat)", value: unixToIso(claims.iat) ?? String(claims.iat) });
  }
  if (typeof claims.nbf === "number") {
    claimFacts.push({ label: "Not before (nbf)", value: unixToIso(claims.nbf) ?? String(claims.nbf) });
  }

  return {
    kind: "jwt_preview",
    version: 1,
    alg,
    typ,
    headerPretty: pretty(header),
    payloadPretty: pretty(claims),
    claimFacts,
    expIso,
    isExpired,
    relativeLabel: relLabel,
    signaturePresent: typeof signatureSeg === "string" && signatureSeg.length > 0,
  };
}

export function decodeJwtPayload(value: unknown): JwtPayload | null {
  try {
    const parsed = (typeof value === "string" ? JSON.parse(value) : value ?? {}) as { kind?: string };
    if (parsed.kind !== "jwt_preview") return null;
    return parsed as JwtPayload;
  } catch {
    return null;
  }
}

export const attachment = defineAttachment<JwtPayload>(ATTACHMENT_TYPE);
