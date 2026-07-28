# Text Tools

Nine auto-run text transform actions for [Clipbus](https://clipbus.app).

## Actions

| ID | Title | What it does |
|---|---|---|
| `text-sort` | Sort Lines | Sorts all lines alphabetically and numerically (case-insensitive, natural order). |
| `text-dedup` | Remove Duplicate Lines | Removes later duplicate lines, preserving the first occurrence and original order. |
| `text-trim` | Tidy Whitespace | Trims leading/trailing spaces on each line, strips leading/trailing blank lines, and collapses runs of 2+ consecutive blank lines into a single blank line. |
| `text-strip-ansi` | Strip ANSI Codes | Removes ANSI escape sequences (SGR colors, cursor moves, OSC title strings, and other control sequences) from terminal output, leaving plain text. |
| `text-reverse-lines` | Reverse Lines | Reverses the order of all lines. |
| `text-reverse-characters` | Reverse Characters | Reverses all user-perceived characters without breaking emoji or combining marks. |
| `text-sort-characters` | Sort Characters | Sorts all user-perceived characters with case-insensitive natural ordering. |
| `text-pretty-json` | Pretty JSON | Parses valid JSON and formats it with two-space indentation. |
| `text-minify-json` | Minify JSON | Parses valid JSON and removes insignificant whitespace. |

All nine actions are `auto-run` (no UI), apply only to `text` clipboard items, and return the transformed text directly. Empty or whitespace-only input yields a "no content" result with no output; invalid JSON yields an "Invalid JSON" result.

## Development

```sh
npm install
npm run verify   # typecheck → lint → build → test
```
