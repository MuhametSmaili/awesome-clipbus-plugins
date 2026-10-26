import { defineAttachment } from "@clipbus/plugin-sdk";

export interface WorldClockZone {
  label: string;
  time: string;
  offset: string;
}

export interface TimestampPayload {
  kind: "timestamp_preview";
  version: 1;
  original: string;
  unit: "seconds" | "milliseconds";
  epochMs: number;
  iso: string;
  utc: string;
  local: string;
  weekday: string;
  zones: WorldClockZone[];
}

const ATTACHMENT_TYPE = "plugin.converter.timestamp";
const SECONDS_RE = /^\d{10}$/;
const MILLIS_RE = /^\d{13}$/;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const WORLD_ZONES: { label: string; iana: string }[] = [
  { label: "UTC", iana: "UTC" },
  { label: "Los Angeles", iana: "America/Los_Angeles" },
  { label: "New York", iana: "America/New_York" },
  { label: "London", iana: "Europe/London" },
  { label: "Paris", iana: "Europe/Paris" },
  { label: "Kolkata", iana: "Asia/Kolkata" },
  { label: "Shanghai", iana: "Asia/Shanghai" },
  { label: "Tokyo", iana: "Asia/Tokyo" },
  { label: "Sydney", iana: "Australia/Sydney" },
];

export function buildWorldClockZones(date: Date): WorldClockZone[] {
  return WORLD_ZONES.map(({ label, iana }) => {
    const timeFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: iana,
      weekday: "short",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = timeFmt.formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const time = `${get("weekday")} ${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;

    const offsetFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: iana,
      timeZoneName: "shortOffset",
    });
    const offsetParts = offsetFmt.formatToParts(date);
    const offset = offsetParts.find((p) => p.type === "timeZoneName")?.value ?? "";

    return { label, time, offset };
  });
}

export function createTimestampPayload(input: unknown): TimestampPayload | null {
  const content = (input as { content?: { kind?: string; text?: string } } | null)?.content;
  if (content?.kind !== "text" || typeof content.text !== "string") return null;

  const original = content.text.trim();

  let unit: "seconds" | "milliseconds";
  let epochMs: number;

  if (SECONDS_RE.test(original)) {
    unit = "seconds";
    epochMs = parseInt(original, 10) * 1000;
  } else if (MILLIS_RE.test(original)) {
    unit = "milliseconds";
    epochMs = parseInt(original, 10);
  } else {
    return null;
  }

  const date = new Date(epochMs);
  const utcYear = date.getUTCFullYear();
  if (utcYear < 2001 || utcYear > 2099) return null;

  return {
    kind: "timestamp_preview",
    version: 1,
    original,
    unit,
    epochMs,
    iso: date.toISOString(),
    utc: date.toUTCString(),
    local: date.toLocaleString(),
    weekday: WEEKDAYS[date.getUTCDay()],
    zones: buildWorldClockZones(date),
  };
}

export function decodeTimestampPayload(value: unknown): TimestampPayload | null {
  try {
    const p = (typeof value === "string" ? JSON.parse(value) : value ?? {}) as { kind?: string };
    if (p.kind !== "timestamp_preview") return null;
    const payload = p as TimestampPayload;
    if (!Array.isArray(payload.zones)) payload.zones = [];
    return payload;
  } catch {
    return null;
  }
}

export const attachment = defineAttachment<TimestampPayload>(ATTACHMENT_TYPE);
