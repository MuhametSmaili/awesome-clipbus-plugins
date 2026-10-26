# Decoder

Clipbus plugin that detects encoded clipboard strings and exposes composable encoding and escaping actions.

## Features

### Base64 (`base64-*`)

| Capability | id | Description |
|---|---|---|
| detector | `base64-detector` | Recognises Base64 strings (standard `+/=` and URL-safe `-_` variants) only when they decode to valid, readable UTF-8 text; rejects binary and garbled output |
| renderer | `base64-renderer` | Card view: encoding type badge, character count comparison (original → decoded), decoded text, and a "Copy Decoded Result" button |

### JWT (`jwt-*`, local decode only — signature not verified)

| Capability | id | Description |
|---|---|---|
| detector | `jwt-detector` | Recognises three-part `header.payload.signature` JWT strings |
| renderer | `jwt-renderer` | Card view: algorithm badge, formatted header/payload JSON, standard claim summary, and expiry status |

### Data URI (`data-uri-*`)

| Capability | id | Description |
|---|---|---|
| detector | `data-uri-detector` | Recognises RFC 2397 data URIs (`data:[mediatype][;base64],<data>`), anchored — rejects bare base64, URLs, and prose |
| renderer | `data-uri` | Card view: media type, encoding label, decoded byte size, decoded text preview with "Copy decoded" button for text types, or an image-data note for binary types |

### Encoding and escaping actions

Ten independent actions provide URL, HTML, Base64, Unicode, and JSON encode/decode pairs. Each action consumes the current cascade text and returns text that can continue through another host action.

## Development

```bash
npm install
npm run dev       # start the preview workbench
npm run verify    # typecheck + lint + build + test (full gate)
```
