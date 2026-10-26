# Preview

Uses SDK 2.x, plugin protocol V2 and manifest schema v5.

Clipbus plugin that detects color values and Markdown text on the clipboard, rendering a rich color swatch with WCAG contrast analysis or a sanitised HTML preview card.

## Features

### Color Swatch (`color-*`)

Detects a single CSS color value in clipboard text and renders a rich preview card.

- **Detector** (`color-detector`): attachment type `plugin.preview.color`. Supports:
  - **Hex**: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` (short forms expanded; alpha channel preserved)
  - **RGB / RGBA**: `rgb(r, g, b)` and `rgba(r, g, b, a)` with channel clamping
  - **HSL / HSLA**: `hsl(h, s%, l%)` and `hsla(h, s%, l%, a)` converted to RGB
  - **28 CSS named colors**: `red`, `blue`, `orange`, `coral`, `tomato`, `salmon`, and more (case-insensitive)
- **Renderer** (`color-swatch`): Fixed height of 260px. Displays:
  - A 120px swatch block filled with the detected color; the hex label is rendered in whichever of white or black achieves higher WCAG contrast
  - HEX, RGB, and HSL values in monospace type
  - Contrast ratios vs. white and black with WCAG level badges (AA if >= 4.5:1, AAA if >= 7:1)
  - "Copy All Formats" host button that copies all three format strings to the clipboard

### Gradient Swatch (`gradient-*`)

Detects a single CSS gradient function on the clipboard and renders it as a live swatch.

- **Detector** (`gradient-detector`): attachment type `plugin.preview.gradient`. Fires when the entire clipboard text is exactly one of: `linear-gradient`, `radial-gradient`, `conic-gradient`, `repeating-linear-gradient`, `repeating-radial-gradient`, or `repeating-conic-gradient`. Requires balanced parentheses and non-empty inner content; rejects plain colors, CSS declarations with a property prefix, and unterminated strings.
- **Renderer** (`gradient-swatch`): Fixed height of 260px. Displays:
  - A 120px swatch block rendered with the gradient as its background
  - The gradient type (with "repeating-" prefix if applicable) and leading angle or shape (e.g. "to right", "circle", "from 45deg")
  - The extracted stop colors as labeled chips, each with a color preview
  - "Copy Gradient" host button that copies the full gradient string to the clipboard

### Markdown Preview (`markdown-*`)

Detects Markdown text on the clipboard and renders it as a sanitised HTML card.

- **Detector** (`markdown-detector`): attachment type `plugin.preview.markdown`. Recognises common Markdown patterns (headings, lists, code blocks, bold/italic, links).
- **Renderer** (`markdown-renderer`): Renders parsed Markdown to safe HTML using a whitelist sanitiser. Height adapts from 120px to 480px to fit the content.

## Development

```sh
npm install
npm run dev       # Vite preview workbench
npm run verify    # typecheck + lint + build + tests
```

To load in Clipbus: Settings → Plugins → Developer Plugins → Add Path, select this directory.
