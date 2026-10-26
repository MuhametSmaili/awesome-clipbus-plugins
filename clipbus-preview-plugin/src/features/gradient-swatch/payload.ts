import { defineAttachment } from "@clipbus/plugin-sdk";

export const ATTACHMENT_TYPE = "plugin.preview.gradient";

export interface GradientPayload {
  kind: "gradient_swatch";
  version: 1;
  gradient: string;
  gradientType: "linear" | "radial" | "conic";
  repeating: boolean;
  stops: string[];
  angleOrShape: string | null;
}

export const attachment = defineAttachment<GradientPayload>(ATTACHMENT_TYPE);

const GRADIENT_PREFIX_RE = /^(repeating-)?(linear|radial|conic)-gradient\s*\(/i;

/** True when s is a complete, balanced CSS gradient function with non-empty inner content. */
function isGradientString(s: string): boolean {
  if (!GRADIENT_PREFIX_RE.test(s)) return false;
  if (s[s.length - 1] !== ')') return false;

  const firstParen = s.indexOf('(');
  // Must have non-empty inner content
  if (firstParen + 1 >= s.length - 1) return false;

  let depth = 0;
  for (let i = firstParen; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) {
        // Closing paren must be the last character
        return i === s.length - 1;
      }
    }
  }
  return false;
}

/** Split a string by commas at paren-depth 0. */
function splitDepthZero(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(s.slice(start).trim());
  return parts;
}

// Small set of CSS color names that appear as gradient stops.
const STOP_NAMED_COLORS = new Set([
  'red', 'blue', 'green', 'white', 'black', 'transparent', 'orange',
  'yellow', 'purple', 'pink', 'cyan', 'magenta', 'gray', 'grey', 'lime',
  'teal', 'navy', 'maroon', 'olive', 'silver', 'brown', 'aqua', 'fuchsia',
  'coral', 'salmon', 'tomato', 'gold', 'indigo', 'violet',
]);

/** Collect all color stop tokens from a gradient inner string, in document order, deduped. */
function extractStops(inner: string): string[] {
  type Hit = { pos: number; token: string };
  const hits: Hit[] = [];

  // HEX: #rgb, #rgba, #rrggbb, #rrggbbaa — not followed by more hex digits
  for (const m of inner.matchAll(/#[0-9a-fA-F]{3,8}(?![0-9a-fA-F])/g)) {
    hits.push({ pos: m.index!, token: m[0] });
  }
  // rgb() / rgba() / hsl() / hsla()
  for (const m of inner.matchAll(/(?:rgba?|hsla?)\([^)]*\)/gi)) {
    hits.push({ pos: m.index!, token: m[0] });
  }
  // Common CSS named colors
  for (const m of inner.matchAll(/\b([a-zA-Z]+)\b/g)) {
    const w = m[1].toLowerCase();
    if (STOP_NAMED_COLORS.has(w)) {
      hits.push({ pos: m.index!, token: w });
    }
  }

  hits.sort((a, b) => a.pos - b.pos);

  const seen = new Set<string>();
  const result: string[] = [];
  for (const { token } of hits) {
    const key = token.toLowerCase().replace(/\s+/g, '');
    if (!seen.has(key)) {
      seen.add(key);
      result.push(token);
    }
  }
  return result;
}

/** True when a string segment contains at least one color token. */
function hasColorToken(segment: string): boolean {
  if (/#[0-9a-fA-F]{3,8}(?![0-9a-fA-F])/i.test(segment)) return true;
  if (/(?:rgba?|hsla?)\([^)]*\)/i.test(segment)) return true;
  for (const m of segment.matchAll(/\b([a-zA-Z]+)\b/g)) {
    if (STOP_NAMED_COLORS.has(m[1].toLowerCase())) return true;
  }
  return false;
}

/**
 * Build a GradientPayload from a detector input object.
 * Returns null if the content is not exactly a CSS gradient function.
 * Pure JS — no node:* imports.
 */
export function createGradientPayload(input: unknown): GradientPayload | null {
  const content = (
    input as { content?: { kind?: string; text?: string } } | null
  )?.content;
  if (content?.kind !== "text" || typeof content.text !== "string") return null;

  const gradient = content.text.trim();
  if (!isGradientString(gradient)) return null;

  // Extract type and repeating flag
  const prefixMatch = gradient.match(/^(repeating-)?(linear|radial|conic)-gradient\s*\(/i);
  if (!prefixMatch) return null;

  const repeating = prefixMatch[1] !== undefined;
  const gradientType = prefixMatch[2].toLowerCase() as "linear" | "radial" | "conic";

  // Extract inner content between the first ( and its matching )
  const firstParen = gradient.indexOf('(');
  const inner = gradient.slice(firstParen + 1, gradient.length - 1);

  // Determine angleOrShape from the first depth-0 comma segment
  const segments = splitDepthZero(inner);
  let angleOrShape: string | null = null;
  if (segments.length > 0 && !hasColorToken(segments[0])) {
    angleOrShape = segments[0] || null;
  }

  const stops = extractStops(inner);

  return {
    kind: "gradient_swatch",
    version: 1,
    gradient,
    gradientType,
    repeating,
    stops,
    angleOrShape,
  };
}

/**
 * Decode and validate a structured payload (or serialized domain sample). Returns null for bad/missing data.
 */
export function decodeGradientPayload(
  value: unknown
): GradientPayload | null {
  try {
    const p = (typeof value === "string" ? JSON.parse(value) : value) as GradientPayload | null;
    if (p?.kind !== "gradient_swatch" || p.version !== 1) return null;
    return p as GradientPayload;
  } catch {
    return null;
  }
}
