import manifest from "../../../manifest.json";
import type { PreviewScenario } from "@clipbus/plugin-sdk/preview";
import { createVibePayload } from "../../features/vibe-fallback/payload";

const declared = manifest.renderers[0];

function renderer(id: string, label: string, text: string, settings?: Record<string, unknown>): PreviewScenario {
  const attachment = {
    type: declared.attachmentType, key: "primary", updatedAt: 1, own: true,
    payload: createVibePayload({ content: { kind: "text", text } })!,
  };
  return {
    id, label, view: declared.id,
    plugin: { id: manifest.plugin.id, version: manifest.plugin.version },
    item: {
      id: `item-${id}`, kind: "text", tags: [], sourceApp: "com.preview.editor",
      pinned: false, createdAt: 1, lastCopiedAt: 1,
      attachments: [{ type: attachment.type, key: attachment.key, updatedAt: attachment.updatedAt, own: attachment.own }],
    },
    content: { kind: "text", text },
    attachment,
    renderer: { title: declared.title, tint: declared.tint, buttons: declared.buttons },
    height: declared.height,
    settings,
  };
}

export const attachmentScenarios: PreviewScenario[] = [
  renderer("fallback-text", "Fallback — Plain Text", "hello world"),
  renderer("fallback-short", "Fallback — Short Word", "Vibe"),
  renderer("fallback-loop", "Settings — Text Loop First", "hello world", { animations: ["text-loop", "particle-core"] }),
  renderer("fallback-reveal", "Settings — Text Reveal Only", "Vibe", { animations: "text-reveal" }),
];
