// payload.ts — UI-safe single source of truth for the XML Formatter attachment.
// NO `import … from "node:*"` here: this file is imported by app.vue (browser) too.

import { defineAttachment } from "@clipbus/plugin-sdk";

const ATTACHMENT_TYPE = "plugin.formatter.xml";
const MAX_INPUT = 20000;
const INDENT = "  ";

export interface XmlPayload {
  kind: "xml_preview";
  version: 1;
  formatted: string;
  elementCount: number;
  attributeCount: number;
  maxDepth: number;
}

// ── Low-level tokenizer ───────────────────────────────────────────────────────

type Token =
  | { type: "prolog" | "comment" | "cdata"; raw: string }
  | { type: "open" | "self"; name: string; attrs: string; raw: string }
  | { type: "close"; name: string; raw: string }
  | { type: "text"; raw: string };

/** Scan forward from `start` to find the closing `>`, respecting quoted strings. */
function findTagEnd(xml: string, start: number): number {
  let i = start;
  while (i < xml.length) {
    const ch = xml[i];
    if (ch === '"' || ch === "'") {
      const close = xml.indexOf(ch, i + 1);
      if (close === -1) return -1;
      i = close + 1;
    } else if (ch === ">") {
      return i;
    } else {
      i++;
    }
  }
  return -1;
}

/** Count `=` signs that are NOT inside quoted attribute values. */
function countAttrsInString(attrs: string): number {
  let count = 0;
  let inQuote = false;
  let quoteChar = "";
  for (const ch of attrs) {
    if (inQuote) {
      if (ch === quoteChar) inQuote = false;
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === "=") {
      count++;
    }
  }
  return count;
}

function tokenize(xml: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < xml.length) {
    if (xml[pos] !== "<") {
      // Text node — collect until next `<`
      const end = xml.indexOf("<", pos);
      const text = end === -1 ? xml.slice(pos) : xml.slice(pos, end);
      const trimmed = text.trim();
      if (trimmed) tokens.push({ type: "text", raw: trimmed });
      pos = end === -1 ? xml.length : end;
      continue;
    }

    // Comment <!-- … -->
    if (xml.startsWith("<!--", pos)) {
      const end = xml.indexOf("-->", pos + 4);
      const raw = end === -1 ? xml.slice(pos) : xml.slice(pos, end + 3);
      tokens.push({ type: "comment", raw });
      pos = end === -1 ? xml.length : end + 3;
      continue;
    }

    // CDATA <![CDATA[ … ]]>
    if (xml.startsWith("<![CDATA[", pos)) {
      const end = xml.indexOf("]]>", pos + 9);
      const raw = end === -1 ? xml.slice(pos) : xml.slice(pos, end + 3);
      tokens.push({ type: "cdata", raw });
      pos = end === -1 ? xml.length : end + 3;
      continue;
    }

    // DOCTYPE and other <! constructs (not CDATA)
    if (xml.startsWith("<!", pos)) {
      const end = xml.indexOf(">", pos + 2);
      const raw = end === -1 ? xml.slice(pos) : xml.slice(pos, end + 1);
      tokens.push({ type: "prolog", raw });
      pos = end === -1 ? xml.length : end + 1;
      continue;
    }

    // Prolog <?…?>
    if (xml.startsWith("<?", pos)) {
      const end = xml.indexOf("?>", pos + 2);
      const raw = end === -1 ? xml.slice(pos) : xml.slice(pos, end + 2);
      tokens.push({ type: "prolog", raw });
      pos = end === -1 ? xml.length : end + 2;
      continue;
    }

    // Close tag </name>
    if (xml[pos + 1] === "/") {
      const end = xml.indexOf(">", pos + 2);
      if (end === -1) { pos++; continue; }
      const raw = xml.slice(pos, end + 1);
      const name = raw.slice(2, -1).trim();
      tokens.push({ type: "close", name, raw });
      pos = end + 1;
      continue;
    }

    // Open or self-closing tag
    const tagEnd = findTagEnd(xml, pos + 1);
    if (tagEnd === -1) { pos++; continue; }
    const raw = xml.slice(pos, tagEnd + 1);
    const isSelf = raw.endsWith("/>");
    const inner = isSelf ? raw.slice(1, -2) : raw.slice(1, -1);
    const nameMatch = inner.match(/^[\w:.-]+/);
    const name = nameMatch ? nameMatch[0] : "";
    const attrs = inner.slice(name.length);
    tokens.push(
      isSelf
        ? { type: "self", name, attrs, raw }
        : { type: "open", name, attrs, raw }
    );
    pos = tagEnd + 1;
  }

  return tokens;
}

// ── Formatter & analyzer ──────────────────────────────────────────────────────

function formatXml(source: string): {
  formatted: string;
  elementCount: number;
  attributeCount: number;
  maxDepth: number;
} {
  let truncated = false;
  let input = source.trim();
  if (input.length > MAX_INPUT) {
    input = input.slice(0, MAX_INPUT);
    truncated = true;
  }

  const tokens = tokenize(input);
  let depth = 0;
  let elementCount = 0;
  let attributeCount = 0;
  let maxDepth = 0;
  const lines: string[] = [];

  for (const tok of tokens) {
    const pad = INDENT.repeat(Math.max(0, depth));
    switch (tok.type) {
      case "prolog":
      case "comment":
      case "cdata":
        lines.push(pad + tok.raw);
        break;
      case "open":
        lines.push(pad + tok.raw);
        elementCount++;
        attributeCount += countAttrsInString(tok.attrs);
        depth++;
        if (depth > maxDepth) maxDepth = depth;
        break;
      case "close": {
        depth = Math.max(0, depth - 1);
        lines.push(INDENT.repeat(depth) + tok.raw);
        break;
      }
      case "self":
        lines.push(pad + tok.raw);
        elementCount++;
        attributeCount += countAttrsInString(tok.attrs);
        if (depth + 1 > maxDepth) maxDepth = depth + 1;
        break;
      case "text":
        lines.push(pad + tok.raw);
        break;
    }
  }

  let formatted = lines.join("\n");
  if (truncated) formatted += "\n... (input too large, truncated)";
  return { formatted, elementCount, attributeCount, maxDepth };
}

// ── Detection heuristic ───────────────────────────────────────────────────────

/** Return true for text that looks like an XML/HTML fragment (not JSON, not plain prose). */
function looksLikeXml(text: string): boolean {
  const t = text.trim();
  // Must start with < and end with >
  if (!t.startsWith("<") || !t.endsWith(">")) return false;
  // Reject JSON objects
  if (t.startsWith("{")) return false;
  // Must have at least 2 tag-like tokens (ensures at least minimal structure)
  const tagMatches = t.match(/<[^>]+>/g);
  return tagMatches !== null && tagMatches.length >= 2;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function createXmlPayload(input: unknown): XmlPayload | null {
  const content = (input as { content?: { kind?: string; text?: string } } | null)?.content;
  if (content?.kind !== "text" || typeof content.text !== "string") return null;

  const raw = content.text.trim();
  if (!looksLikeXml(raw)) return null;

  const { formatted, elementCount, attributeCount, maxDepth } = formatXml(raw);

  return {
    kind: "xml_preview",
    version: 1,
    formatted,
    elementCount,
    attributeCount,
    maxDepth,
  };
}

export function decodeXmlPayload(value: unknown): XmlPayload | null {
  try {
    const parsed = (typeof value === "string" ? JSON.parse(value) : value ?? {}) as { kind?: string };
    if (parsed.kind !== "xml_preview") return null;
    return parsed as XmlPayload;
  } catch {
    return null;
  }
}

export const attachment = defineAttachment<XmlPayload>(ATTACHMENT_TYPE);
