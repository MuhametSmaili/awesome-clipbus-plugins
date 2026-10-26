import type { PreviewScenario } from "@clipbus/plugin-sdk/preview";
import type { PluginManifestRenderer } from "@clipbus/plugin-sdk";
import manifest from "../../../manifest.json";
import { createCronPayload } from "../../features/cron-renderer/payload.ts";

const renderer: PluginManifestRenderer = manifest.renderers.find((entry) => entry.id === "cron-renderer")!;
const content = { kind: "text" as const, text: "30 9 * * 1-5" };
const reference = { type: renderer.attachmentType, key: "primary", updatedAt: 1, own: true };

export const attachmentScenarios: PreviewScenario[] = [
  {
    id: "cron-weekdays-morning",
    label: "Weekdays at 9:30",
    view: renderer.id,
    plugin: { id: manifest.plugin.id, version: manifest.plugin.version },
    item: {
      id: "item-cron-weekdays-morning", kind: "text", tags: ["cron"],
      sourceApp: "com.preview.editor", pinned: false, createdAt: 1, lastCopiedAt: 1,
      attachments: [reference],
    },
    content,
    attachment: { ...reference, payload: createCronPayload({ content })! },
    renderer: { title: renderer.title, tint: renderer.tint, buttons: renderer.buttons },
    height: renderer.height,
  },
];
