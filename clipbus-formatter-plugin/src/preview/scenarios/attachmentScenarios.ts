// Attachment preview scenarios for the dev workbench.
// Consumed by createPreviewWorkbench (preview-host/main.ts); `view` selects the
// feature component to mount. Add one entry per attachment renderer feature.

import manifest from "../../../manifest.json";
import type { PreviewScenario } from "@clipbus/plugin-sdk/preview";

const PLUGIN_ID = manifest.plugin.id;
const ITEM_TAGS = ["formatter"];
const SOURCE_APP = "com.preview.editor";

// Richer sample: nested array + a string that needs quoting (contains ": ")
// so the YAML view demonstrates both cases clearly.
const jsonObjectPayload = {
  kind: "json_formatter_preview",
  version: 1,
  originalLength: 99,
  formatted:
    '{\n  "name": "api",\n  "url": "https://x.y/z?a=1",\n  "note": "value: with colon",\n  "ports": [\n    80,\n    443\n  ],\n  "enabled": true\n}',
  formattedLength: 133,
  yaml: 'name: api\nurl: https://x.y/z?a=1\nnote: "value: with colon"\nports:\n  - 80\n  - 443\nenabled: true',
  minified: '{"name":"api","url":"https://x.y/z?a=1","note":"value: with colon","ports":[80,443],"enabled":true}',
  topLevelType: "object",
  topLevelCount: 5,
  display: {
    typeLabel: "JSON Object",
    headline: "JSON Object · 5 keys",
    subheadline: "99 → 133 chars",
  },
};

const jsonArrayPayload = {
  kind: "json_formatter_preview",
  version: 1,
  originalLength: 9,
  formatted: '[\n  1,\n  2,\n  3\n]',
  formattedLength: 16,
  yaml: "- 1\n- 2\n- 3",
  minified: "[1,2,3]",
  topLevelType: "array",
  topLevelCount: 3,
  display: {
    typeLabel: "JSON Array",
    headline: "JSON Array · 3 items",
    subheadline: "9 → 16 chars",
  },
};

// 3-column, 3-row sample; "note" column has a value that contains a comma
// (the result of parsing a quoted field like `"handles, UX & motion"`) to
// demonstrate that CSV quoting is preserved through the JSON export.
const csvTablePayload = {
  kind: "csv_table",
  version: 1,
  delimiter: ",",
  headers: ["name", "role", "note"],
  rows: [
    ["Alice", "Engineer", "works on infra"],
    ["Bob", "Designer", "handles, UX & motion"],
    ["Carol", "PM", "leads roadmap"],
  ],
  rowCount: 3,
  colCount: 3,
  display: {
    typeLabel: "CSV Table",
    headline: "3 columns × 3 rows",
    facts: [
      { label: "Rows", value: "3" },
      { label: "Columns", value: "3" },
      { label: "Delimiter", value: "comma" },
    ],
  },
};

const xmlPayload = {
  kind: "xml_preview",
  version: 1,
  formatted:
    '<?xml version="1.0" encoding="UTF-8"?>\n<catalog>\n  <book id="bk101">\n    <author>Gambardella, Matthew</author>\n    <title>XML Developer\'s Guide</title>\n    <genre>Computer</genre>\n    <price>44.95</price>\n  </book>\n  <book id="bk102">\n    <author>Ralls, Kim</author>\n    <title>Midnight Rain</title>\n    <genre>Fantasy</genre>\n    <price>5.95</price>\n  </book>\n</catalog>',
  elementCount: 10,
  attributeCount: 2,
  maxDepth: 3,
};

/** Build a V2 card scenario; view routes to the real feature component. */
function renderer(opts: {
  id: string;
  label: string;
  view: string;
  payload: object;
}): PreviewScenario {
  const declared = manifest.renderers.find((entry) => entry.id === opts.view)!;
  const reference = { type: declared.attachmentType, key: "primary", updatedAt: 1, own: true };
  return {
    id: opts.id,
    label: opts.label,
    view: opts.view,
    plugin: { id: PLUGIN_ID, version: manifest.plugin.version },
    item: {
      id: 'item-' + opts.id, kind: "text", tags: ITEM_TAGS, sourceApp: SOURCE_APP,
      pinned: false, createdAt: 1, lastCopiedAt: 1, attachments: [reference],
    },
    attachment: { ...reference, payload: opts.payload },
    renderer: { title: declared.title, tint: declared.tint, buttons: declared.buttons },
    height: declared.height,
  };
}

export const attachmentScenarios: PreviewScenario[] = [
  renderer({
    id: "json-renderer-object",
    label: "JSON Object",
    view: "json-renderer",
    payload: jsonObjectPayload,
  }),
  renderer({
    id: "json-renderer-array",
    label: "JSON Array",
    view: "json-renderer",
    payload: jsonArrayPayload,
  }),
  renderer({
    id: "xml-renderer-catalog",
    label: "XML: book catalog",
    view: "xml-renderer",
    payload: xmlPayload,
  }),
  renderer({
    id: "csv-table-basic",
    label: "CSV Table",
    view: "csv-table",
    payload: csvTablePayload,
  }),
];
