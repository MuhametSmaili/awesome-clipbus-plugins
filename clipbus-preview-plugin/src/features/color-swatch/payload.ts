import { defineAttachment } from "@clipbus/plugin-sdk";

export const ATTACHMENT_TYPE = "plugin.preview.color";

export interface ColorPayload {
  kind: "color_swatch";
  version: 1;
  input: string;
  rgb: { r: number; g: number; b: number; a: number };
  hex: string;
  rgbString: string;
  hslString: string;
  luminance: number;
  bestTextColor: "#ffffff" | "#000000";
  contrastWhite: number;
  contrastBlack: number;
  display: {
    typeLabel: string;
    headline: string;
    facts: { label: string; value: string }[];
  };
}

export const attachment = defineAttachment<ColorPayload>(ATTACHMENT_TYPE);

// 28 common CSS named colors
const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  maroon: "#800000",
  olive: "#808000",
  lime: "#00ff00",
  aqua: "#00ffff",
  teal: "#008080",
  navy: "#000080",
  fuchsia: "#ff00ff",
  purple: "#800080",
  orange: "#ffa500",
  pink: "#ffc0cb",
  brown: "#a52a2a",
  gold: "#ffd700",
  indigo: "#4b0082",
  violet: "#ee82ee",
  coral: "#ff7f50",
  salmon: "#fa8072",
  tomato: "#ff6347",
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  // h in degrees [0, 360), s and l in [0, 1]
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) {
    h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  } else if (max === gn) {
    h = ((bn - rn) / d + 2) / 6;
  } else {
    h = ((rn - gn) / d + 4) / 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function linearizeChannel(c: number): number {
  const cn = c / 255;
  return cn <= 0.03928 ? cn / 12.92 : Math.pow((cn + 0.055) / 1.055, 2.4);
}

function computeLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * linearizeChannel(r) +
    0.7152 * linearizeChannel(g) +
    0.0722 * linearizeChannel(b)
  );
}

/**
 * Parse a whole-string (trimmed) CSS color. Returns RGBA or null if not recognized.
 * Accepts: named colors, #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(), rgba(), hsl(), hsla().
 */
export function parseColor(
  text: string
): { r: number; g: number; b: number; a: number } | null {
  const s = text.trim();
  if (!s) return null;

  // Named color (case-insensitive)
  const named = NAMED_COLORS[s.toLowerCase()];
  if (named) return parseColor(named);

  // Hex
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
      return { r, g, b, a: 1 };
    }
    if (hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = parseInt(hex[3] + hex[3], 16) / 255;
      if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) return null;
      return { r, g, b, a };
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
      return { r, g, b, a: 1 };
    }
    if (hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = parseInt(hex.slice(6, 8), 16) / 255;
      if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) return null;
      return { r, g, b, a };
    }
    return null;
  }

  // rgb() / rgba()
  const rgbMatch = s.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i
  );
  if (rgbMatch) {
    const r = clamp(parseInt(rgbMatch[1], 10), 0, 255);
    const g = clamp(parseInt(rgbMatch[2], 10), 0, 255);
    const b = clamp(parseInt(rgbMatch[3], 10), 0, 255);
    const a =
      rgbMatch[4] !== undefined ? clamp(parseFloat(rgbMatch[4]), 0, 1) : 1;
    return { r, g, b, a };
  }

  // hsl() / hsla()
  const hslMatch = s.match(
    /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+))?\s*\)$/i
  );
  if (hslMatch) {
    let h = parseFloat(hslMatch[1]) % 360;
    if (h < 0) h += 360;
    const sl = clamp(parseFloat(hslMatch[2]) / 100, 0, 1);
    const l = clamp(parseFloat(hslMatch[3]) / 100, 0, 1);
    const a =
      hslMatch[4] !== undefined ? clamp(parseFloat(hslMatch[4]), 0, 1) : 1;
    const { r, g, b } = hslToRgb(h, sl, l);
    return { r, g, b, a };
  }

  return null;
}

/**
 * Build a complete ColorPayload from a detector input object.
 */
export function createColorPayload(input: unknown): ColorPayload | null {
  const content = (
    input as { content?: { kind?: string; text?: string } } | null
  )?.content;
  if (content?.kind !== "text" || typeof content.text !== "string") return null;

  const text = content.text.trim();
  const rgba = parseColor(text);
  if (!rgba) return null;

  const { r, g, b, a } = rgba;

  const toHex2 = (n: number) =>
    Math.round(clamp(n, 0, 255))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();

  const hexBase = `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
  const hex = a < 1 ? `${hexBase}${toHex2(a * 255)}` : hexBase;

  const aRounded = Math.round(a * 100) / 100;
  const rgbString =
    a < 1
      ? `rgba(${r}, ${g}, ${b}, ${aRounded})`
      : `rgb(${r}, ${g}, ${b})`;

  const { h, s: sl, l } = rgbToHsl(r, g, b);
  const hslString =
    a < 1
      ? `hsla(${h}, ${sl}%, ${l}%, ${aRounded})`
      : `hsl(${h}, ${sl}%, ${l}%)`;

  const lum = computeLuminance(r, g, b);
  // WCAG: white luminance = 1.0, black luminance = 0.0
  const contrastWhite = 1.05 / (lum + 0.05);
  const contrastBlack = (lum + 0.05) / 0.05;
  const bestTextColor: "#ffffff" | "#000000" =
    contrastWhite >= contrastBlack ? "#ffffff" : "#000000";

  return {
    kind: "color_swatch",
    version: 1,
    input: text,
    rgb: { r, g, b, a },
    hex,
    rgbString,
    hslString,
    luminance: Math.round(lum * 10000) / 10000,
    bestTextColor,
    contrastWhite: Math.round(contrastWhite * 10) / 10,
    contrastBlack: Math.round(contrastBlack * 10) / 10,
    display: {
      typeLabel: "Color",
      headline: hex,
      facts: [
        { label: "HEX", value: hex },
        { label: "RGB", value: rgbString },
        { label: "HSL", value: hslString },
      ],
    },
  };
}

/**
 * Decode and validate a structured payload (or serialized domain sample). Returns null for bad/missing data.
 */
export function decodeColorPayload(
  value: unknown
): ColorPayload | null {
  try {
    const p = (typeof value === "string" ? JSON.parse(value) : value) as ColorPayload | null;
    if (p?.kind !== "color_swatch" || p.version !== 1) return null;
    return p as ColorPayload;
  } catch {
    return null;
  }
}
