import { defineAttachment } from "@clipbus/plugin-sdk";

export const ATTACHMENT_TYPE = "plugin.extractor.ip" as const;

// ── Named types ───────────────────────────────────────────────────────────────

export type IpScope =
  | "Loopback"
  | "Unspecified"
  | "Link-local"
  | "Unique-local"
  | "Multicast"
  | "Private"
  | "Reserved"
  | "Public"
  | "Global Unicast";

// ── Payload shapes ────────────────────────────────────────────────────────────

interface IpPayloadBase {
  kind: "ip_details";
  version: 1;
  input: string;
}

export interface IpPayloadV4 extends IpPayloadBase {
  inputType: "ipv4";
  ipVersion: 4;
  integer: number;
  hex: string;
  binary: string;
  reverseDns: string;
  scope: IpScope;
  legacyClass: string;
}

export interface IpPayloadV4Cidr extends IpPayloadBase {
  inputType: "ipv4cidr";
  ipVersion: 4;
  prefix: number;
  netmask: string;
  wildcardMask: string;
  networkAddress: string;
  broadcastAddress: string;
  firstUsable: string;
  lastUsable: string;
  totalAddresses: number;
  usableHostCount: number;
  scope: IpScope;
  legacyClass: string;
}

export interface IpPayloadV6 extends IpPayloadBase {
  inputType: "ipv6";
  ipVersion: 6;
  expanded: string;
  compressed: string;
  scope: IpScope;
}

export interface IpPayloadV6Cidr extends IpPayloadBase {
  inputType: "ipv6cidr";
  ipVersion: 6;
  expanded: string;
  compressed: string;
  prefix: number;
  networkPrefix: string;
  totalAddresses: string;
  scope: IpScope;
}

export type IpPayload =
  | IpPayloadV4
  | IpPayloadV4Cidr
  | IpPayloadV6
  | IpPayloadV6Cidr;

// ── IPv4 helpers ──────────────────────────────────────────────────────────────

/** Parse a dotted-quad string into four octets or null. */
function parseIPv4Octets(s: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const o = [+m[1], +m[2], +m[3], +m[4]];
  if (o.some((x) => x > 255)) return null;
  return o;
}

/** Convert four octets to a uint32 (multiplication avoids signed-bit issues). */
function octetsToUint32(o: number[]): number {
  return o[0] * 16777216 + o[1] * 65536 + o[2] * 256 + o[3];
}

/** Convert a uint32 back to four octets using unsigned right-shifts. */
function uint32ToOctets(n: number): number[] {
  const u = n >>> 0;
  return [(u >>> 24) & 0xff, (u >>> 16) & 0xff, (u >>> 8) & 0xff, u & 0xff];
}

function octetsToStr(o: number[]): string {
  return o.join(".");
}

/** Build a /prefix netmask as a uint32. Handles prefix=0 and prefix=32 correctly. */
function prefixToNetmask32(prefix: number): number {
  if (prefix === 0) return 0;
  return ((0xffffffff << (32 - prefix)) >>> 0);
}

function getIPv4Scope(o: number[]): IpScope {
  const [a, b] = o;
  if (a === 127) return "Loopback";
  if (a === 10) return "Private";
  if (a === 172 && b >= 16 && b <= 31) return "Private";
  if (a === 192 && b === 168) return "Private";
  if (a === 169 && b === 254) return "Link-local";
  if (a >= 224 && a <= 239) return "Multicast";
  if (a >= 240) return "Reserved";
  return "Public";
}

function getIPv4LegacyClass(o: number[]): string {
  const first = o[0];
  if (first < 128) return "A";
  if (first < 192) return "B";
  if (first < 224) return "C";
  if (first < 240) return "D";
  return "E";
}

// ── IPv6 helpers ──────────────────────────────────────────────────────────────

/**
 * Parse an IPv6 address string into exactly 8 lowercase 4-hex-digit groups,
 * expanding '::' notation. Returns null for any malformed input.
 */
function parseIPv6Groups(s: string): string[] | null {
  if (s.includes("::")) {
    const parts = s.split("::");
    if (parts.length !== 2) return null; // more than one '::'
    const left = parts[0] ? parts[0].split(":") : [];
    const right = parts[1] ? parts[1].split(":") : [];
    const fill = 8 - left.length - right.length;
    if (fill < 0) return null; // too many groups
    const groups = [...left, ...Array<string>(fill).fill("0"), ...right];
    if (groups.length !== 8) return null;
    const result: string[] = [];
    for (const g of groups) {
      // Require 1-4 hex digits: an empty group here means a stray ':' produced
      // a malformed address such as "2001:::1" or a trailing-colon "2001::db8:".
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
      result.push(g.padStart(4, "0").toLowerCase());
    }
    return result;
  } else {
    const groups = s.split(":");
    if (groups.length !== 8) return null;
    const result: string[] = [];
    for (const g of groups) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
      result.push(g.padStart(4, "0").toLowerCase());
    }
    return result;
  }
}

/** RFC 5952: compress an expanded 8-group IPv6 address. Collapses the first
 *  longest run of consecutive zero groups (min length 2) into '::'. */
function compressIPv6(groups: string[]): string {
  const nums = groups.map((g) => parseInt(g, 16));

  // Find the first longest run of consecutive zeros (min 2 to collapse).
  let bestStart = -1;
  let bestLen = 1; // threshold: only collapse runs longer than this
  let curStart = -1;
  let curLen = 0;

  for (let i = 0; i < 8; i++) {
    if (nums[i] === 0) {
      if (curStart === -1) {
        curStart = i;
        curLen = 1;
      } else {
        curLen++;
      }
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }

  const hex = nums.map((n) => n.toString(16));

  if (bestStart === -1) return hex.join(":");

  const left = hex.slice(0, bestStart).join(":");
  const right = hex.slice(bestStart + bestLen).join(":");
  if (!left && !right) return "::";
  if (!left) return "::" + right;
  if (!right) return left + "::";
  return left + "::" + right;
}

/** Apply a /prefix mask to 8 expanded IPv6 groups, zeroing bits beyond prefix. */
function applyIPv6Prefix(groups: string[], prefix: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < 8; i++) {
    const bitsAvail = prefix - i * 16;
    if (bitsAvail >= 16) {
      result.push(groups[i]);
    } else if (bitsAvail <= 0) {
      result.push("0000");
    } else {
      const mask = ((0xffff << (16 - bitsAvail)) >>> 0) & 0xffff;
      const val = parseInt(groups[i], 16) & mask;
      result.push(val.toString(16).padStart(4, "0"));
    }
  }
  return result;
}

function getIPv6Scope(groups: string[]): IpScope {
  if (groups.every((g) => g === "0000")) return "Unspecified";
  if (
    groups.slice(0, 7).every((g) => g === "0000") &&
    groups[7] === "0001"
  )
    return "Loopback";

  const firstGroup = parseInt(groups[0], 16);
  const firstByte = (firstGroup >>> 8) & 0xff;

  if (firstByte === 0xff) return "Multicast";
  if (firstByte === 0xfe && (firstGroup & 0xffc0) === 0xfe80)
    return "Link-local";
  if ((firstByte & 0xfe) === 0xfc) return "Unique-local";
  return "Global Unicast";
}

// ── CIDR prefix validator ─────────────────────────────────────────────────────

function parseCidrPrefix(s: string, max: number): number | null {
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = parseInt(s, 10);
  if (n < 0 || n > max) return null;
  return n;
}

// ── Payload builders ──────────────────────────────────────────────────────────

function buildV4Payload(input: string, o: number[]): IpPayloadV4 {
  const integer = octetsToUint32(o);
  return {
    kind: "ip_details",
    version: 1,
    input,
    inputType: "ipv4",
    ipVersion: 4,
    integer,
    hex: "0x" + integer.toString(16).toUpperCase().padStart(8, "0"),
    binary: o.map((x) => x.toString(2).padStart(8, "0")).join("."),
    reverseDns: `${o[3]}.${o[2]}.${o[1]}.${o[0]}.in-addr.arpa`,
    scope: getIPv4Scope(o),
    legacyClass: getIPv4LegacyClass(o),
  };
}

function buildV4CidrPayload(
  input: string,
  o: number[],
  prefix: number
): IpPayloadV4Cidr {
  const ipInt = octetsToUint32(o);
  const nmInt = prefixToNetmask32(prefix);
  const wcInt = (~nmInt) >>> 0;
  const netInt = (ipInt & nmInt) >>> 0;
  const bcastInt = (ipInt | wcInt) >>> 0;

  const total = Math.pow(2, 32 - prefix);
  const usable = prefix <= 30 ? total - 2 : total;
  const firstUsable =
    prefix <= 30
      ? octetsToStr(uint32ToOctets((netInt + 1) >>> 0))
      : octetsToStr(uint32ToOctets(netInt));
  const lastUsable =
    prefix <= 30
      ? octetsToStr(uint32ToOctets((bcastInt - 1) >>> 0))
      : octetsToStr(uint32ToOctets(bcastInt));

  return {
    kind: "ip_details",
    version: 1,
    input,
    inputType: "ipv4cidr",
    ipVersion: 4,
    prefix,
    netmask: octetsToStr(uint32ToOctets(nmInt)),
    wildcardMask: octetsToStr(uint32ToOctets(wcInt)),
    networkAddress: octetsToStr(uint32ToOctets(netInt)),
    broadcastAddress: octetsToStr(uint32ToOctets(bcastInt)),
    firstUsable,
    lastUsable,
    totalAddresses: total,
    usableHostCount: usable,
    scope: getIPv4Scope(o),
    legacyClass: getIPv4LegacyClass(o),
  };
}

function buildV6Payload(input: string, groups: string[]): IpPayloadV6 {
  const expanded = groups.join(":");
  return {
    kind: "ip_details",
    version: 1,
    input,
    inputType: "ipv6",
    ipVersion: 6,
    expanded,
    compressed: compressIPv6(groups),
    scope: getIPv6Scope(groups),
  };
}

function buildV6CidrPayload(
  input: string,
  groups: string[],
  prefix: number
): IpPayloadV6Cidr {
  const netGroups = applyIPv6Prefix(groups, prefix);
  const expanded = groups.join(":");
  return {
    kind: "ip_details",
    version: 1,
    input,
    inputType: "ipv6cidr",
    ipVersion: 6,
    expanded,
    compressed: compressIPv6(groups),
    prefix,
    networkPrefix: compressIPv6(netGroups) + `/${prefix}`,
    totalAddresses: `2^${128 - prefix}`,
    scope: getIPv6Scope(groups),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build an IpPayload from a detector input object.
 * Pure JS — no node:* imports; safe for both UI and runtime.
 * Returns null when the content is not a single valid IP or CIDR.
 */
export function createIpPayload(input: unknown): IpPayload | null {
  const content = (
    input as { content?: { kind?: string; text?: string } } | null
  )?.content;
  if (content?.kind !== "text" || typeof content.text !== "string") return null;

  const text = content.text.trim();
  if (!text) return null;

  const slashIdx = text.indexOf("/");

  if (slashIdx !== -1) {
    // CIDR form
    const ipPart = text.slice(0, slashIdx);
    const prefixPart = text.slice(slashIdx + 1);

    const v4 = parseIPv4Octets(ipPart);
    if (v4) {
      const prefix = parseCidrPrefix(prefixPart, 32);
      if (prefix === null) return null;
      return buildV4CidrPayload(text, v4, prefix);
    }

    const v6 = parseIPv6Groups(ipPart);
    if (v6) {
      const prefix = parseCidrPrefix(prefixPart, 128);
      if (prefix === null) return null;
      return buildV6CidrPayload(text, v6, prefix);
    }

    return null;
  } else {
    // Plain address
    const v4 = parseIPv4Octets(text);
    if (v4) return buildV4Payload(text, v4);

    if (text.includes(":")) {
      const v6 = parseIPv6Groups(text);
      if (v6) return buildV6Payload(text, v6);
    }

    return null;
  }
}

/**
 * Decode a structured payload or a serialized payload.
 * Returns null for missing or malformed data.
 */
export function decodeIpPayload(
  value: unknown
): IpPayload | null {
  try {
    const p = (typeof value === "string" ? JSON.parse(value) : value) as { kind?: string };
    if (!p || typeof p !== "object" || p.kind !== "ip_details") return null;
    return p as IpPayload;
  } catch {
    return null;
  }
}

export const attachment = defineAttachment<IpPayload>(ATTACHMENT_TYPE);
