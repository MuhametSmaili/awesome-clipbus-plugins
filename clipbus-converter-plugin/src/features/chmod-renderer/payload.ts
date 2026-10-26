import { defineAttachment } from "@clipbus/plugin-sdk";

const ATTACHMENT_TYPE = "plugin.converter.chmod";

// Optional leading file-type char + exactly 9 permission chars
// Position 2/5: [xsS-] (owner/group execute, setuid, setgid)
// Position 8: [xtT-] (others execute, sticky)
const PERM_RE = /^([-dlbcps])?([r-][w-][xsS-][r-][w-][xsS-][r-][w-][xtT-])$/;

export interface PermClass {
  label: "Owner" | "Group" | "Others";
  read: boolean;
  write: boolean;
  execute: boolean;
}

export interface ChmodPayload {
  kind: "chmod_preview";
  version: 1;
  input: string;
  octal: string;
  symbolic: string; // normalised 9-char form, no leading type char
  classes: [PermClass, PermClass, PermClass];
  setuid: boolean;
  setgid: boolean;
  sticky: boolean;
  fileType: string | null;
  description: string;
}

const FILE_TYPE_LABELS: Record<string, string> = {
  "-": "file",
  "d": "directory",
  "l": "symlink",
  "b": "block device",
  "c": "character device",
  "p": "pipe",
  "s": "socket",
};

/** Parse one triplet of rwx chars into a PermClass and its octal digit. */
function parseTriplet(
  r: string,
  w: string,
  x: string,
  label: "Owner" | "Group" | "Others"
): { cls: PermClass; digit: number } {
  const read = r === "r";
  const write = w === "w";
  // execute is set when char is 'x', 's' (setuid/setgid+execute), or 't' (sticky+execute)
  // NOT set for 'S', 'T', or '-'
  const execute = x === "x" || x === "s" || x === "t";
  const digit = (read ? 4 : 0) + (write ? 2 : 0) + (execute ? 1 : 0);
  return { cls: { label, read, write, execute }, digit };
}

export function parsePermissions(text: string): ChmodPayload | null {
  const trimmed = text.trim();
  const m = trimmed.match(PERM_RE);
  if (!m) return null;

  const typeChar = m[1] ?? null;
  const perms = m[2]; // exactly 9 chars

  const { cls: ownerCls, digit: ownerDigit } = parseTriplet(perms[0], perms[1], perms[2], "Owner");
  const { cls: groupCls, digit: groupDigit } = parseTriplet(perms[3], perms[4], perms[5], "Group");
  const { cls: othersCls, digit: othersDigit } = parseTriplet(perms[6], perms[7], perms[8], "Others");

  // Special bits: setuid from owner[2] ∈ {s,S}, setgid from group[2] ∈ {s,S}, sticky from others[2] ∈ {t,T}
  const setuid = perms[2] === "s" || perms[2] === "S";
  const setgid = perms[5] === "s" || perms[5] === "S";
  const sticky = perms[8] === "t" || perms[8] === "T";

  const specialDigit = (setuid ? 4 : 0) + (setgid ? 2 : 0) + (sticky ? 1 : 0);
  const octal =
    specialDigit > 0
      ? `${specialDigit}${ownerDigit}${groupDigit}${othersDigit}`
      : `${ownerDigit}${groupDigit}${othersDigit}`;

  const fileType = typeChar !== null ? (FILE_TYPE_LABELS[typeChar] ?? null) : null;

  // Human description
  const classDescs = [ownerCls, groupCls, othersCls].map((c) => {
    const bits = [
      c.read ? "read" : null,
      c.write ? "write" : null,
      c.execute ? "execute" : null,
    ]
      .filter(Boolean)
      .join("/") || "none";
    return `${c.label}: ${bits}`;
  });
  const specialParts: string[] = [];
  if (setuid) specialParts.push("setuid");
  if (setgid) specialParts.push("setgid");
  if (sticky) specialParts.push("sticky");
  const specialDesc = specialParts.length > 0 ? `; ${specialParts.join(", ")}` : "";
  const typeDesc = fileType ? `${fileType}, ` : "";
  const description = `${typeDesc}${classDescs.join("; ")}${specialDesc}`;

  return {
    kind: "chmod_preview",
    version: 1,
    input: trimmed,
    octal,
    symbolic: perms,
    classes: [ownerCls, groupCls, othersCls],
    setuid,
    setgid,
    sticky,
    fileType,
    description,
  };
}

export function createChmodPayload(input: unknown): ChmodPayload | null {
  const content = (input as { content?: { kind?: string; text?: string } } | null)?.content;
  if (content?.kind !== "text" || typeof content.text !== "string") return null;
  return parsePermissions(content.text);
}

export function decodeChmodPayload(
  value: unknown
): ChmodPayload | null {
  try {
    const p = (typeof value === "string" ? JSON.parse(value) : value ?? {}) as { kind?: string };
    if (p.kind !== "chmod_preview") return null;
    return p as ChmodPayload;
  } catch {
    return null;
  }
}

export const attachment = defineAttachment<ChmodPayload>(ATTACHMENT_TYPE);
