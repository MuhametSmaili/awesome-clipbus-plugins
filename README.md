# Clipbus Plugin Collection

English | [中文](./README_zh.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**The official plugin collection for Clipbus — the programmable clipboard for macOS.** A growing collection of ready-to-install plugins, plus the tools to write your own.

[clipbus.com](https://clipbus.com) · [Plugin docs](https://clipbus.com/plugin-doc)

## Install into Clipbus

The primary way to use these plugins is installing straight from this repository — no clone, no local build required.

1. Open Clipbus and go to **Settings → Plugins → Install → Git Repository**. This opens the **"Install From Git Repository"** panel.
2. Fill in the form:

   | Field | Value |
   |---|---|
   | Repository URL | `https://github.com/scubers/awesome-clipbus-plugins` |
   | Subdirectory | the plugin's directory name, e.g. `clipbus-decoder-plugin` — see the **Subdirectory** column in the [Plugins table](#plugins) below |
   | Ref | leave blank to track `main`, or pin a branch/tag/commit |

3. Click **Install**.

Clipbus's free tier includes 3 slots per capability type (detector / renderer / action) — Pro lifts the limits and adds Cloud Sync.

## Build and maintain plugins with AI

1. Clone this repository.
2. Open the repository with your preferred AI coding agent.
3. Describe the plugin or maintenance task you want to complete.

Two repository skills under `.agents/skills/` provide purpose-built workflows:

- **Create — `clipbus-plugin-generator`:** Surveys the existing collection, then extends the best-matching plugin or scaffolds a new one. It implements the feature and runs the full verification gate while avoiding near-duplicates.
- **Sync — `clipbus-template-sync`:** Pulls updates from the official plugin template and Plugin SDK, determines which shared changes affect existing plugins, and migrates and verifies them as needed.

## Plugins

Each plugin below lives in its own top-level directory and is fully self-contained (own `npm install`, own build) — there is no root `package.json` or shared build orchestration. The **Subdirectory** column can be pasted directly into the install form above.

| Plugin | Subdirectory | Description | Demo |
|--------|--------------|-------------|------|
| [clipbus-decoder-plugin](./clipbus-decoder-plugin/README.md) | `clipbus-decoder-plugin` | Detect readable UTF-8 Base64, JWT, and `data:` URIs, plus 10 independent auto-run URL / HTML / Base64 / Unicode / JSON encode/decode actions designed for host-side cascades. | [GIF](./docs/gifs/decoder.gif) |
| [clipbus-formatter-plugin](./clipbus-formatter-plugin/README.md) | `clipbus-formatter-plugin` | Detect and format JSON / XML, including pretty/minified/YAML JSON views, and render CSV/TSV as a table with JSON export. | — |
| [clipbus-converter-plugin](./clipbus-converter-plugin/README.md) | `clipbus-converter-plugin` | Numeric, time, unit, and permission conversions, plus 10 independent auto-run naming-case actions that can be cascaded by the host. | — |
| [clipbus-extractor-plugin](./clipbus-extractor-plugin/README.md) | `clipbus-extractor-plugin` | Extract and parse URLs, naked query strings, entities, IP/CIDR, coordinates, MAC addresses, and UUIDs; URL Details also strips tracking parameters and preserves duplicate query pairs. Includes a regex tester draft. | — |
| [clipbus-preview-plugin](./clipbus-preview-plugin/README.md) | `clipbus-preview-plugin` | Visual previews for colors (with WCAG contrast), CSS gradients, and sanitised Markdown. | [GIF](./docs/gifs/preview.gif) |
| [clipbus-text-plugin](./clipbus-text-plugin/README.md) | `clipbus-text-plugin` | Nine independent auto-run text actions for JSON pretty-printing/minification, sorting, deduping, whitespace cleanup, ANSI stripping, and reversing or sorting characters/lines. | — |
| [clipbus-image-plugin](./clipbus-image-plugin/README.md) | `clipbus-image-plugin` | Interactive image crop, resize, format conversion, and compression through a dedicated draft action. | — |
| [clipbus-generator-plugin](./clipbus-generator-plugin/README.md) | `clipbus-generator-plugin` | Generate a UUID v4, a sortable ULID, or a strong random password (configurable length / case / digits / symbols / count) via Web Crypto, plus Lorem Ipsum placeholder text (paragraphs / sentences / words); live-preview and copy from a draft form. | — |
| [clipbus-cron-plugin](./clipbus-cron-plugin/README.md) | `clipbus-cron-plugin` | Detect 5-field cron expressions: a per-field explanation table, a one-sentence summary, and the next 5 fire times (live, local time), guarded to avoid misfiring on ordinary number rows. | — |
| [clipbus-vibe-plugin](./clipbus-vibe-plugin/README.md) | `clipbus-vibe-plugin` | Emotional fallback for plain text with no structured match: three switchable Three.js particle animations — ① Particle Core: glyphs burst → noise drift → glowing Fibonacci sphere; ② Text Reveal: readable text (≥ 0.6 s, glyph-fit scaled) → light scan → edge disintegration → burst → polyhedral data crystal; ③ Text Loop: seamless 8-phase cycle — text → scatter → burst → drift cloud → sphere recall → stable sphere → deconstruct → text reassembly. A native button bar switches between them; which animations appear and their order are configurable via the `plugin.vibe.animations` setting (defaults to all three). | [GIF](./docs/gifs/vibe.gif) |

`template-plugin/` is the official scaffold and full-capability reference — it is meant to be **copied**, not installed. It is not a product plugin, so it is not listed in the table above. New plugins created with the AI workflow above start life as a copy of it.

## Community plugins

Building a Clipbus plugin outside this collection? List it here.

_No community plugins yet — be the first._

| Plugin | Description | Repository | Install Subdirectory |
|--------|-------------|------------|-----------------------|
| _(your plugin)_ | _one-line description_ | `https://github.com/<you>/<repo>` | leave blank unless your repo hosts multiple plugins |

To add a row, open a PR — see **Contributing** below.

## Contributing

There are two ways to contribute:

1. **PR into this repository** to join the official collection. Your plugin directory must pass its own build and test gate — `npm install && npm run verify` (build + test) inside that directory. See [CLAUDE.md](./CLAUDE.md) for the plugin architecture, the four extension points (detector / renderer / action / messageHandlers), the cross-file wiring invariants, and the new-plugin workflow.
2. **Maintain your own repository** and submit a PR adding a row to the [Community plugins](#community-plugins) table above. Only the link and description are reviewed — not the code.
