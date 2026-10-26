// payload.ts — UI-safe single source of truth for the Data URI preview attachment.
// NO `import … from "node:*"` here: this file is imported by app.vue (browser) too.
// Uses only cross-platform globals: atob, TextEncoder, TextDecoder, decodeURIComponent.

import { defineAttachment } from "@clipbus/plugin-sdk";

export const ATTACHMENT_TYPE = "plugin.decoder.datauri";

const MAX_PREVIEW_CHARS = 2000;

export interface DataUriPayload {
  kind: "data_uri_preview";
  version: 1;
  mediaType: string;
  isDefault: boolean;
  isBase64: boolean;
  encodingLabel: string;
  decodedSize: string;
  isImage: boolean;
  isText: boolean;
  decodedTextPreview: string | null;
  decodedTextTruncated: boolean;
  decodeError: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TEXT_MIME_TYPES = [
  "application/json",
  "application/xml",
  "application/javascript",
  "application/ecmascript",
  "application/xhtml+xml",
];

function classifyMediaType(mediaType: string): { isImage: boolean; isText: boolean } {
  // Take the type/subtype part only (strip parameters)
  const primary = mediaType.split(";")[0].trim().toLowerCase();
  const isImage = primary.startsWith("image/");
  const isText = primary.startsWith("text/") || TEXT_MIME_TYPES.includes(primary);
  return { isImage, isText };
}

export function createDataUriPayload(input: unknown): DataUriPayload | null {
  const content = (input as { content?: { kind?: string; text?: string } } | null)?.content;
  if (content?.kind !== "text" || typeof content.text !== "string") return null;

  const raw = content.text.trim();

  // Anchored match — rejects prose, bare base64, URLs, and anything without data: prefix + comma.
  const match = /^data:([^,]*),([\s\S]*)$/.exec(raw);
  if (!match) return null;

  const header = match[1];
  const dataPart = match[2];

  // Parse header into mediaType + isBase64 flag.
  // RFC 2397: data:[<mediatype>][;base64],<data>
  // `;base64` appears as the LAST semicolon-delimited segment of the header.
  const headerParts = header.split(";");
  let isBase64 = false;
  if (headerParts[headerParts.length - 1]?.trim().toLowerCase() === "base64") {
    isBase64 = true;
    headerParts.pop();
  }

  const mediaTypeRaw = headerParts.join(";").trim();
  let mediaType: string;
  let isDefault: boolean;
  if (!mediaTypeRaw) {
    // RFC 2397 §3: omitted mediatype defaults to text/plain;charset=US-ASCII
    mediaType = "text/plain;charset=US-ASCII";
    isDefault = true;
  } else {
    mediaType = mediaTypeRaw;
    isDefault = false;
  }

  const encodingLabel = isBase64 ? "Base64" : "URL-encoded / plain";
  const { isImage, isText } = classifyMediaType(mediaType);

  let decodedSize = "0 B";
  let decodedTextPreview: string | null = null;
  let decodedTextTruncated = false;
  let decodeError = false;

  if (isBase64) {
    // Compute decoded byte length via formula — avoid decoding potentially huge payloads.
    const b64 = dataPart.replace(/\s/g, "");
    const len = b64.length;
    const paddingCount = (b64.match(/=+$/) ?? [""])[0].length;
    const byteLen = Math.floor((len * 3) / 4) - paddingCount;
    decodedSize = formatBytes(Math.max(0, byteLen));

    if (isText && !isImage) {
      try {
        const rawDecoded = atob(b64);
        const bytes = new Uint8Array(rawDecoded.length);
        for (let i = 0; i < rawDecoded.length; i++) {
          bytes[i] = rawDecoded.charCodeAt(i);
        }
        let text = new TextDecoder("utf-8").decode(bytes);
        if (text.length > MAX_PREVIEW_CHARS) {
          text = text.slice(0, MAX_PREVIEW_CHARS);
          decodedTextTruncated = true;
        }
        decodedTextPreview = text;
      } catch {
        decodeError = true;
        decodedTextPreview = null;
      }
    }
  } else {
    // URL-encoded / plain
    try {
      const decoded = decodeURIComponent(dataPart);
      const byteLen = new TextEncoder().encode(decoded).length;
      decodedSize = formatBytes(byteLen);

      if (isText && !isImage) {
        let text = decoded;
        if (text.length > MAX_PREVIEW_CHARS) {
          text = text.slice(0, MAX_PREVIEW_CHARS);
          decodedTextTruncated = true;
        }
        decodedTextPreview = text;
      }
    } catch {
      // decodeURIComponent failed (malformed percent-encoding); fall back to raw length.
      decodeError = true;
      decodedSize = formatBytes(dataPart.length);
    }
  }

  return {
    kind: "data_uri_preview",
    version: 1,
    mediaType,
    isDefault,
    isBase64,
    encodingLabel,
    decodedSize,
    isImage,
    isText,
    decodedTextPreview,
    decodedTextTruncated,
    decodeError,
  };
}

export function decodeDataUriPayload(value: unknown): DataUriPayload | null {
  try {
    const parsed = (typeof value === "string" ? JSON.parse(value) : value ?? {}) as { kind?: string };
    if (parsed.kind !== "data_uri_preview") return null;
    return parsed as DataUriPayload;
  } catch {
    return null;
  }
}

export const attachment = defineAttachment<DataUriPayload>(ATTACHMENT_TYPE);
