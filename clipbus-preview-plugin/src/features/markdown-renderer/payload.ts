// payload.ts — UI-safe single source of truth for the Markdown preview attachment.
// NO `import … from "node:*"` here: this file is imported by app.vue (browser) too.
// Pure string processing only — no Node-specific globals needed.

import { defineAttachment } from "@clipbus/plugin-sdk";

export const ATTACHMENT_TYPE = "plugin.preview.markdown";

export interface MarkdownPayload {
  kind: "markdown_preview";
  version: 1;
  html: string;
  sourceChars: number;
  lineCount: number;
  headingCount: number;
}

export const attachment = defineAttachment<MarkdownPayload>(ATTACHMENT_TYPE);

// ── Signal detection (for detector heuristic) ────────────────────────────────

// Seven distinct signal kinds; at least 2 must match to avoid misidentifying prose.
const SIGNAL_HEADING = /^#{1,6}\s/m;
const SIGNAL_BOLD_ITALIC = /\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_/;
const SIGNAL_LIST = /^[ \t]*[-*+]\s|^[ \t]*\d+\.\s/m;
const SIGNAL_LINK = /\[[^\]]+\]\([^)]+\)/;
const SIGNAL_FENCED_CODE = /^```/m;
const SIGNAL_INLINE_CODE = /`[^`\n]+`/;
const SIGNAL_BLOCKQUOTE = /^>\s/m;

function countSignalKinds(text: string): number {
  let count = 0;
  if (SIGNAL_HEADING.test(text)) count++;
  if (SIGNAL_BOLD_ITALIC.test(text)) count++;
  if (SIGNAL_LIST.test(text)) count++;
  if (SIGNAL_LINK.test(text)) count++;
  if (SIGNAL_FENCED_CODE.test(text)) count++;
  if (SIGNAL_INLINE_CODE.test(text)) count++;
  if (SIGNAL_BLOCKQUOTE.test(text)) count++;
  return count;
}

// ── HTML rendering ───────────────────────────────────────────────────────────

/** Escape HTML special characters. Must be called before inserting text into markup. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Allow only http, https, and mailto URLs; anything else degrades to plain text. */
function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) return trimmed;
  return null;
}

/** Apply bold, italic, and inline code to an already-HTML-escaped string. */
function applyInlineFormatting(escaped: string): string {
  // Inline code first so its content is preserved verbatim.
  escaped = escaped.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  // Bold (**x**)
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, (_, t) => `<strong>${t}</strong>`);
  // Italic (*x*)
  escaped = escaped.replace(/\*([^*\n]+)\*/g, (_, t) => `<em>${t}</em>`);
  // Italic (_x_)
  escaped = escaped.replace(/_([^_\n]+)_/g, (_, t) => `<em>${t}</em>`);
  return escaped;
}

/**
 * Render inline markdown on a raw (unescaped) string.
 * Links are processed first so the raw URL can be safety-checked before escaping.
 */
function renderInline(raw: string): string {
  const parts: string[] = [];
  let lastIndex = 0;
  const linkRe = /\[([^\]]*)\]\(([^)]*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkRe.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push(applyInlineFormatting(escapeHtml(raw.slice(lastIndex, match.index))));
    }
    const href = safeHref(match[2]);
    const linkText = applyInlineFormatting(escapeHtml(match[1]));
    if (href !== null) {
      parts.push(`<a href="${escapeHtml(href)}">${linkText}</a>`);
    } else {
      parts.push(linkText);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < raw.length) {
    parts.push(applyInlineFormatting(escapeHtml(raw.slice(lastIndex))));
  }

  return parts.join("");
}

/**
 * Render a markdown source string to a safe HTML string.
 * Only a curated subset of markdown is supported; raw HTML is never passed through.
 * All text nodes are HTML-escaped before any markdown patterns are applied.
 */
export function renderMarkdown(src: string): string {
  const lines = src.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block (``` lang ... ```)
    if (/^```/.test(line)) {
      const lang = escapeHtml(line.slice(3).trim());
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      i++; // consume closing ```
      const langAttr = lang ? ` class="language-${lang}"` : "";
      out.push(`<pre><code${langAttr}>${codeLines.join("\n")}</code></pre>`);
      continue;
    }

    // ATX heading (# … ######)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      out.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote (> …)
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${renderMarkdown(quoteLines.join("\n"))}</blockquote>`);
      continue;
    }

    // Unordered list (- / * / +)
    if (/^[ \t]*[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[ \t]*[-*+]\s/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^[ \t]*[-*+]\s/, ""))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // Ordered list (1. / 2. …)
    if (/^[ \t]*\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[ \t]*\d+\.\s/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^[ \t]*\d+\.\s/, ""))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // Blank line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph — collect consecutive non-block lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^[ \t]*[-*+]\s/.test(lines[i]) &&
      !/^[ \t]*\d+\.\s/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      out.push(`<p>${paraLines.map(renderInline).join("<br>")}</p>`);
    }
  }

  return out.join("\n");
}

// ── Payload factories ────────────────────────────────────────────────────────

export function createMarkdownPayload(src: string): MarkdownPayload {
  const html = renderMarkdown(src);
  const lineCount = src.split("\n").length;
  const headingCount = (src.match(/^#{1,6}\s/gm) ?? []).length;
  return {
    kind: "markdown_preview",
    version: 1,
    html,
    sourceChars: src.length,
    lineCount,
    headingCount,
  };
}

export function decodeMarkdownPayload(value: unknown): MarkdownPayload | null {
  try {
    const parsed = (typeof value === "string" ? JSON.parse(value) : value) as MarkdownPayload | null;
    if (parsed?.kind !== "markdown_preview" || parsed.version !== 1) return null;
    return parsed as MarkdownPayload;
  } catch {
    return null;
  }
}

export function detectMarkdownPayload(input: unknown): MarkdownPayload | null {
  const content = (input as { content?: { kind?: string; text?: string } } | null)?.content;
  if (content?.kind !== "text" || typeof content.text !== "string") return null;

  const src = content.text.trim();
  if (src.length === 0) return null;
  if (countSignalKinds(src) < 2) return null;

  return createMarkdownPayload(src);
}
