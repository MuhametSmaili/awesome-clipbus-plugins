// Attachment preview scenarios for the dev workbench.
// Consumed by createPreviewWorkbench (preview-host/main.ts); `view` selects the
// feature component to mount. Add one entry per attachment renderer feature.

import manifest from "../../../manifest.json";
import type { PreviewScenario } from "@clipbus/plugin-sdk/preview";
import { buildWorldClockZones } from "../../features/timestamp-renderer/payload.ts";
import { createFilesizePayload } from "../../features/filesize-renderer/payload.ts";
import { parsePermissions } from "../../features/chmod-renderer/payload.ts";

const PLUGIN_ID = "plugin.converter";
const ITEM_TAGS = ["converter"];
const SOURCE_APP = "com.preview.editor";

const timestampDate = new Date(1700000000000);
const timestampPayload = JSON.stringify({
  kind: "timestamp_preview",
  version: 1,
  original: "1700000000",
  unit: "seconds",
  epochMs: 1700000000000,
  iso: "2023-11-14T22:13:20.000Z",
  utc: "Tue, 14 Nov 2023 22:13:20 GMT",
  local: "2023/11/15 06:13:20",
  weekday: "Tuesday",
  zones: buildWorldClockZones(timestampDate),
});

const durationPayload = JSON.stringify({
  kind: "duration_preview",
  version: 1,
  original: "P1Y2M10DT2H30M",
  components: { years: 1, months: 2, days: 10, hours: 2, minutes: 30 },
  humanBreakdown: "1 year, 2 months, 10 days, 2 hours, 30 minutes",
  totalSeconds: 37690200,
  approximate: true,
});

const temperaturePayload = JSON.stringify({
  kind: "temperature_preview",
  version: 1,
  sourceScale: "C",
  sourceValue: 37,
  celsius: 37,
  fahrenheit: 98.6,
  kelvin: 310.15,
  belowAbsoluteZero: false,
});

const filesizePayload = JSON.stringify(
  createFilesizePayload({ content: { kind: "text", text: "1.5 GB" } })
);

const chmodPayload = JSON.stringify(parsePermissions("rwxr-xr-x"));

const radixPayload = JSON.stringify({
  kind: "radix_preview",
  version: 1,
  inputBase: "dec",
  decimal: "255",
  hex: "0xff",
  octal: "0o377",
  binary: "0b11111111",
  bits: 8,
  asciiChar: null,
  isNegative: false,
});

/** Build a V2 card scenario from this plugin's payload and manifest defaults. */
function renderer(opts: {
  id: string; label: string; view: string; accentHex: string;
  attachmentType: string; payloadJson: string; min: number; max: number;
}): PreviewScenario {
  const declared = manifest.renderers.find((entry) => entry.id === opts.view)!;
  const shown = { type: opts.attachmentType, key: "primary", updatedAt: 1, own: true, payload: JSON.parse(opts.payloadJson) };
  return {
    id: opts.id, label: opts.label, view: opts.view,
    plugin: { id: PLUGIN_ID, version: manifest.plugin.version },
    item: { id: `item-${opts.id}`, kind: "text", tags: ITEM_TAGS, sourceApp: SOURCE_APP,
      pinned: false, createdAt: 1, lastCopiedAt: 1,
      attachments: [{ type: shown.type, key: shown.key, updatedAt: shown.updatedAt, own: shown.own }] },
    attachment: shown,
    renderer: { title: declared.title, tint: declared.tint, buttons: declared.buttons },
    height: declared.height,
  };
}

export const attachmentScenarios: PreviewScenario[] = [
  renderer({
    id: "timestamp-renderer-seconds",
    label: "Unix Timestamp: 1700000000 (seconds)",
    view: "timestamp-renderer",
    accentHex: "#0F766E",
    attachmentType: "plugin.converter.timestamp",
    min: 140,
    max: 460,
    payloadJson: timestampPayload,
  }),
  renderer({
    id: "duration-sample",
    label: "ISO 8601 Duration: P1Y2M10DT2H30M",
    view: "duration",
    accentHex: "#7C3AED",
    attachmentType: "plugin.converter.duration",
    min: 140,
    max: 300,
    payloadJson: durationPayload,
  }),
  renderer({
    id: "temperature-sample",
    label: "Temperature: 37°C (body temperature)",
    view: "temperature",
    accentHex: "#EF4444",
    attachmentType: "plugin.converter.temperature",
    min: 140,
    max: 300,
    payloadJson: temperaturePayload,
  }),
  renderer({
    id: "radix-renderer-sample",
    label: "Radix: 255 decimal",
    view: "radix-renderer",
    accentHex: "#4F46E5",
    attachmentType: "plugin.converter.radix",
    min: 120,
    max: 300,
    payloadJson: radixPayload,
  }),
  renderer({
    id: "filesize-renderer-sample",
    label: "Data Size: 1.5 GB",
    view: "filesize-renderer",
    accentHex: "#0369A1",
    attachmentType: "plugin.converter.filesize",
    min: 180,
    max: 420,
    payloadJson: filesizePayload,
  }),
  renderer({
    id: "chmod-renderer-sample",
    label: "File Permissions: rwxr-xr-x",
    view: "chmod-renderer",
    accentHex: "#475569",
    attachmentType: "plugin.converter.chmod",
    min: 180,
    max: 380,
    payloadJson: chmodPayload,
  }),
];
