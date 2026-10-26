import { defineAttachment } from "@clipbus/plugin-sdk";

export const ATTACHMENT_TYPE = "plugin.extractor.url" as const;

export interface UrlPayload {
  kind: "url_parsed";
  version: 1;
  inputType: "url" | "query";
  input: string;
  href: string;
  scheme: string;
  username: string;
  host: string;
  port: string;
  path: string;
  query: { key: string; value: string }[];
  queryJson: string;
  hasDuplicateKeys: boolean;
  hash: string;
  cleanHref: string;
  trackingParams: { key: string; value: string }[];
  display: {
    typeLabel: string;
    headline: string;
    facts: { label: string; value: string }[];
  };
}

/** Known tracking query parameter keys (exact match, lowercased). */
const TRACKING_EXACT = new Set([
  "fbclid",
  "fb_action_ids",
  "fb_action_types",
  "fb_source",
  "fb_ref",
  "gclid",
  "gclsrc",
  "dclid",
  "gbraid",
  "wbraid",
  "gad_source",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "_hsenc",
  "_hsmi",
  "__hssc",
  "__hstc",
  "__hsfp",
  "igshid",
  "igsh",
  "yclid",
  "_openstat",
  "vero_id",
  "vero_conv",
  "oly_anon_id",
  "oly_enc_id",
  "wickedid",
  "twclid",
  "ttclid",
  "scid",
  "mkt_tok",
  "_branch_match_id",
  "s_cid",
  "ncid",
  "cmpid",
  "spm",
]);

function isTracking(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.startsWith("utm_") || TRACKING_EXACT.has(lower);
}

function parseQuery(search: string): { key: string; value: string }[] {
  const rawQuery = search.startsWith("?") ? search.slice(1) : search;
  if (!rawQuery) return [];
  return Array.from(new URLSearchParams(rawQuery).entries()).map(([key, value]) => ({
    key,
    value,
  }));
}

function queryMetadata(query: { key: string; value: string }[]) {
  const keys = query.map(({ key }) => key);
  return {
    queryJson: JSON.stringify(Object.fromEntries(query.map(({ key, value }) => [key, value])), null, 2),
    hasDuplicateKeys: new Set(keys).size !== keys.length,
  };
}

/** A conservative naked query-string gate: require at least two key=value pairs. */
export function parseQueryString(text: string): { key: string; value: string }[] | null {
  const value = text.trim();
  if (!value || value.includes("://") || /\s/.test(value)) return null;
  const raw = value.startsWith("?") ? value.slice(1) : value;
  const segments = raw.split("&");
  if (segments.length < 2 || segments.some((segment) => !/^[^=&#]+=[^&#]*$/.test(segment))) {
    return null;
  }
  const query = parseQuery(raw);
  return query.length >= 2 ? query : null;
}

/**
 * Parse a trimmed string as a URL. Accepts only URLs with a scheme + '//' authority
 * (http, https, ftp, ws, wss, or any custom scheme with '//') and a non-empty hostname.
 * Rejects 'mailto:', 'tel:', bare 'a:b', and plain prose.
 */
export function parseUrl(text: string): URL | null {
  const s = text.trim();
  if (!s) return null;
  // Require scheme + '//' (authority-based URL)
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return null;
  try {
    const u = new URL(s);
    if (!u.hostname) return null;
    return u;
  } catch {
    return null;
  }
}

/**
 * Build a complete UrlPayload from a detector input object.
 */
export function createUrlPayload(input: unknown): UrlPayload | null {
  const content = (
    input as { content?: { kind?: string; text?: string } } | null
  )?.content;
  if (content?.kind !== "text" || typeof content.text !== "string") return null;

  const text = content.text.trim();
  const u = parseUrl(text);
  if (!u) {
    const query = parseQueryString(text);
    if (!query) return null;
    const metadata = queryMetadata(query);
    return {
      kind: "url_parsed",
      version: 1,
      inputType: "query",
      input: text,
      href: "",
      scheme: "",
      username: "",
      host: "",
      port: "",
      path: "",
      query,
      ...metadata,
      hash: "",
      cleanHref: "",
      trackingParams: [],
      display: {
        typeLabel: "Query String",
        headline: `${query.length} parameters`,
        facts: [
          { label: "Pairs", value: String(query.length) },
          { label: "Duplicate keys", value: metadata.hasDuplicateKeys ? "Yes" : "No" },
        ],
      },
    };
  }

  const scheme = u.protocol.replace(/:$/, "");
  const host = u.hostname;
  const port = u.port;
  const path = u.pathname;
  const hash = u.hash;
  const username = u.username;
  const query = parseQuery(u.search);
  const metadata = queryMetadata(query);

  const trackingParams = query.filter((q) => isTracking(q.key));
  let cleanHref: string;
  if (trackingParams.length > 0) {
    const cu = new URL(u.href);
    for (const { key } of trackingParams) cu.searchParams.delete(key);
    cleanHref = cu.href;
  } else {
    cleanHref = u.href;
  }

  const facts: { label: string; value: string }[] = [
    { label: "Scheme", value: scheme },
    { label: "Host", value: host },
  ];
  if (port) facts.push({ label: "Port", value: port });
  facts.push({ label: "Path", value: path || "/" });
  if (hash) facts.push({ label: "Hash", value: hash });

  return {
    kind: "url_parsed",
    version: 1,
    inputType: "url",
    input: text,
    href: u.href,
    scheme,
    username,
    host,
    port,
    path,
    query,
    ...metadata,
    hash,
    cleanHref,
    trackingParams,
    display: {
      typeLabel: "URL",
      headline: host,
      facts,
    },
  };
}

/**
 * Decode a structured payload or a serialized payload. Returns null for bad/missing data.
 */
export function decodeUrlPayload(
  value: unknown
): UrlPayload | null {
  try {
    const p = (typeof value === "string" ? JSON.parse(value) : value) as { kind?: string; href?: string; query?: { key: string; value: string }[] };
    if (!p || typeof p !== "object" || p.kind !== "url_parsed") return null;
    const query = Array.isArray(p.query) ? p.query : [];
    const metadata = queryMetadata(query);
    const withDefaults: unknown = {
      inputType: p.href ? "url" : "query",
      trackingParams: [],
      cleanHref: p.href ?? "",
      ...metadata,
      ...(p as object),
    };
    return withDefaults as UrlPayload;
  } catch {
    return null;
  }
}

export const attachment = defineAttachment<UrlPayload>(ATTACHMENT_TYPE);

/** Initial appearance follows the parsed URL, including the tracking cleaner. */
export function createUrlCard(payload: UrlPayload) {
  return {
    title: payload.inputType === "query" ? "Query String" : "URL Details",
    buttons: payload.inputType === "query"
      ? [{ id: "copy", title: "Copy as JSON" }]
      : [
          ...(payload.trackingParams.length > 0 ? [{ id: "copy-clean", title: "Copy clean URL" }] : []),
          { id: "copy", title: "Copy query params (JSON)" },
        ],
  };
}
