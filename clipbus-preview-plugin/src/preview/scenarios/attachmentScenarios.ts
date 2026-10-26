import manifest from "../../../manifest.json";
import type { PreviewScenario } from "@clipbus/plugin-sdk/preview";
import { createColorPayload } from "../../features/color-swatch/payload.ts";
import { createGradientPayload } from "../../features/gradient-swatch/payload.ts";
import { createMarkdownPayload } from "../../features/markdown-renderer/payload.ts";

const markdown = [
  "# Markdown Preview",
  "",
  "A sample paragraph with **bold** and *italic* text, plus `inline code`.",
  "",
  "- Unordered list item A",
  "- Unordered list item B",
  "",
  "> A blockquote example",
  "",
  "```ts",
  "const x: number = 42;",
  "```",
  "",
  "[External link example](https://example.com)",
].join("\n");

function renderer(id: string, label: string, view: string, text: string, payload: object, tint?: string): PreviewScenario {
  const declared = manifest.renderers.find((entry) => entry.id === view)!;
  const reference = { type: declared.attachmentType, key: "primary", updatedAt: 1, own: true };
  return {
    id, label, view,
    plugin: { id: manifest.plugin.id, version: manifest.plugin.version },
    item: {
      id: `item-${id}`, kind: "text", tags: ["preview"], sourceApp: "com.preview.editor",
      pinned: false, createdAt: 1, lastCopiedAt: 1, attachments: [reference],
    },
    content: { kind: "text", text },
    attachment: { ...reference, payload, ...(tint ? { card: { tint } } : {}) },
    renderer: { title: declared.title, tint: declared.tint, buttons: declared.buttons },
    height: declared.height,
  };
}

export const attachmentScenarios: PreviewScenario[] = [
  renderer(
    "color-swatch-blue", "Blue #3366FF", "color-swatch", "#3366ff",
    createColorPayload({ content: { kind: "text", text: "#3366ff" } })!, "#3366FF",
  ),
  renderer(
    "gradient-swatch-linear", "Gradient: Blue→Purple", "gradient-swatch",
    "linear-gradient(to right, #3b82f6, #8b5cf6)",
    createGradientPayload({ content: { kind: "text", text: "linear-gradient(to right, #3b82f6, #8b5cf6)" } })!,
  ),
  renderer(
    "markdown-renderer-sample", "Markdown: Combined Example", "markdown-renderer",
    markdown, createMarkdownPayload(markdown),
  ),
];
