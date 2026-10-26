import { defineAttachment, type PluginDetectInput } from "@clipbus/plugin-sdk";

export const ATTACHMENT_TYPE = "plugin.vibe.fallback";
const MAX_TEXT = 280;

export interface VibePayload {
  kind: "vibe_fallback";
  version: 1;
  text: string;       // 截断的文本样本（粒子字形采样用）
  charCount: number;  // 原始字符数（动画强度/seed 用）
}

export const vibeAttachment = defineAttachment<VibePayload>(ATTACHMENT_TYPE);

export function decodeVibePayload(value: unknown): VibePayload | null {
  try {
    const p = (typeof value === "string" ? JSON.parse(value) : value) as Partial<VibePayload> | null;
    if (!p || p.kind !== "vibe_fallback" || p.version !== 1 || typeof p.text !== "string"
      || typeof p.charCount !== "number" || !Number.isSafeInteger(p.charCount) || p.charCount < 0) return null;
    return p as VibePayload;
  } catch { return null; }
}

export function createVibePayload(input: Pick<PluginDetectInput, "content">): VibePayload | null {
  if (input?.content?.kind !== "text") return null;
  const raw = input.content.text;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;       // 空文本不挂
  return { kind: "vibe_fallback", version: 1, text: trimmed.slice(0, MAX_TEXT), charCount: trimmed.length };
}
