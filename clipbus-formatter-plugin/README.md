# Formatter

Clipbus plugin that detects JSON, XML, and CSV data on the clipboard, formats it, and shows a preview card. Supports one-click copy of the formatted result.

## Features

### JSON (`json-*`)

- **JSON Detector** (`json-detector`): Tries `JSON.parse` on `text` input; attaches `plugin.formatter.json` when the result is an object or array.
- **JSON Formatter** (`json-renderer`): Preview card showing the top-level type (object/array), key/item count, and the 2-space-indented formatted JSON with Pretty, Min, and YAML views and a copy button for the selected format.

### XML (`xml-*`)

- **XML Detector** (`xml-detector`): Detects text containing valid tag structure (element pairs, prolog, or comments) and attaches `plugin.formatter.xml`.
- **XML Formatter** (`xml-renderer`): Preview card showing element count, attribute count, nesting depth, and the indented XML with a "Copy Formatted" button.

### CSV Table (`csv-*`)

- **CSV Detector** (`csv-detector`): Identifies comma-separated values with consistent column counts and attaches `plugin.formatter.csv`.
- **CSV Table** (`csv-table`): Renders the CSV data as a styled table with header row highlighting. Switch between Table and JSON views and copy Markdown or JSON. Height adapts automatically to fit the content.

The plugin uses SDK 2.x and protocol V2 (manifest schema 5). CSV search headers are limited to 4 KiB without splitting Unicode characters. CSV or expanded XML payloads above the SDK’s 2 MiB limit are omitted.\n\n## Development

```sh
npm install
npm run dev       # Vite preview workbench
npm run verify    # typecheck + lint + build + tests (all green before shipping)
```
