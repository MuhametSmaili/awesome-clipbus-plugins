// Attachment preview scenarios for the dev workbench.
// Consumed by createPreviewWorkbench (preview-host/main.ts); `view` selects the
// feature component to mount. Add one entry per attachment renderer feature.

import manifest from "../../../manifest.json";
import type { PreviewScenario } from "@clipbus/plugin-sdk/preview";

const PLUGIN_ID = "plugin.decoder";
const ITEM_TAGS = ["decoder"];
const SOURCE_APP = "com.preview.editor";

const base64HelloPayload = JSON.stringify({
  kind: "base64_preview",
  version: 1,
  originalSnippet: "SGVsbG8sIFdvcmxkIQ==",
  originalLength: 20,
  decoded: "Hello, World!",
  decodedLength: 13,
  isText: true,
  encoding: "standard",
});

const base64JsonPayload = JSON.stringify({
  kind: "base64_preview",
  version: 1,
  originalSnippet: "eyJ1c2VyIjoiYWxpY2UiLCJyb2xlIjoiYWRtaW4ifQ==",
  originalLength: 44,
  decoded: '{"user":"alice","role":"admin"}',
  decodedLength: 30,
  isText: true,
  encoding: "standard",
});

const dataUriTextPayload = JSON.stringify({
  kind: "data_uri_preview",
  version: 1,
  mediaType: "text/plain",
  isDefault: false,
  isBase64: true,
  encodingLabel: "Base64",
  decodedSize: "5 B",
  isImage: false,
  isText: true,
  decodedTextPreview: "Hello",
  decodedTextTruncated: false,
  decodeError: false,
});

const dataUriImagePayload = JSON.stringify({
  kind: "data_uri_preview",
  version: 1,
  mediaType: "image/png",
  isDefault: false,
  isBase64: true,
  encodingLabel: "Base64",
  decodedSize: "8 B",
  isImage: true,
  isText: false,
  decodedTextPreview: null,
  decodedTextTruncated: false,
  decodeError: false,
});

const jwtCanonicalPayload = JSON.stringify({
  kind: "jwt_preview",
  version: 1,
  alg: "HS256",
  typ: "JWT",
  headerPretty: '{\n  "alg": "HS256",\n  "typ": "JWT"\n}',
  payloadPretty: '{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}',
  claimFacts: [
    { label: "sub", value: "1234567890" },
    { label: "name", value: "John Doe" },
  ],
  expIso: null,
  isExpired: null,
  relativeLabel: null,
  signaturePresent: true,
});

/** Build a V2 card scenario from this plugin's payload and manifest defaults. */
function renderer(opts: {
  id: string;
  label: string;
  view: string;
  payloadJson: string;
}): PreviewScenario {
  const declared = manifest.renderers.find((entry) => entry.id === opts.view)!;
  const reference = { type: declared.attachmentType, key: "primary", updatedAt: 1, own: true };
  return {
    id: opts.id,
    label: opts.label,
    view: opts.view,
    plugin: { id: PLUGIN_ID, version: manifest.plugin.version },
    item: {
      id: `item-${opts.id}`, kind: "text", tags: ITEM_TAGS, sourceApp: SOURCE_APP,
      pinned: false, createdAt: 1, lastCopiedAt: 1, attachments: [reference],
    },
    attachment: { ...reference, payload: JSON.parse(opts.payloadJson) },
    renderer: { title: declared.title, tint: declared.tint, buttons: declared.buttons },
    height: declared.height,
  };
}

export const attachmentScenarios: PreviewScenario[] = [
  renderer({
    id: "base64-renderer-hello",
    label: "Base64: Hello, World!",
    view: "base64-renderer",
    payloadJson: base64HelloPayload,
  }),
  renderer({
    id: "base64-renderer-json",
    label: "Base64: JSON payload",
    view: "base64-renderer",
    payloadJson: base64JsonPayload,
  }),
  renderer({
    id: "data-uri-text-plain",
    label: "Data URI: text/plain base64",
    view: "data-uri",
    payloadJson: dataUriTextPayload,
  }),
  renderer({
    id: "data-uri-image-png",
    label: "Data URI: image/png",
    view: "data-uri",
    payloadJson: dataUriImagePayload,
  }),
  renderer({
    id: "jwt-renderer-canonical",
    label: "JWT: HS256 canonical token",
    view: "jwt-renderer",
    payloadJson: jwtCanonicalPayload,
  }),
];
