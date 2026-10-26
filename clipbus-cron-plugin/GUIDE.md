# Cron Explainer Development Guide

*English · [中文](./GUIDE_zh.md)*

This plugin uses SDK 2.0.0, plugin protocol V2 and manifest schema 5. Its detector recognizes five-field cron expressions and writes a structured schedule attachment plus a searchable summary. The card shows the expression, field descriptions, summary and next five runs in local time.

The installed SDK is authoritative: start with `node_modules/@clipbus/plugin-sdk/docs/README.md`, then consult `API.md` for signatures and limits. Read [AGENTS.md](./AGENTS.md) before changing the implementation.

## Development and verification

Run commands inside `clipbus-cron-plugin/`:

```sh
npm install
npm run dev
npm run verify
```

The Vite preview mounts the real Cron card with the “Weekdays at 9:30” scenario. It uses the same V2 startup snapshot as the host. The scenario's `view: "cron-renderer"` routes to the card component; `?scenario=cron-weekdays-morning` selects the sample.

`npm run verify` checks the manifest, typechecks, lints, rebuilds `dist/`, validates declared output files and runs the business, runtime and preview tests. Tests use Node's native TypeScript support; run them with a current Node version. To run tests separately, build first:

```sh
npm run build
npm test
```

## Debugging in Clipbus

1. Open Settings → Plugins → Developer Plugins → **Add Path**.
2. Select this directory containing `manifest.json`.
3. The declared install hook runs `npm install` in this directory.
4. Use **Reload** after changing the manifest or rebuilding. **Run Install** reruns dependency installation; **View Logs** opens install failures.

## Structure and contracts

- `src/plugin.ts` registers `cron-detector`, matching the manifest.
- `src/features/cron-renderer/payload.ts` owns the shared attachment contract, payload construction/decoding, validation, field expansion and next-run calculation.
- `detector.ts` writes `plugin.cron.schedule` and the `cron` search scope through the invocation context. These outputs are declared in `writes`. Every trigger, including recopy, writes the complete matching result.
- `app.vue` reads the startup attachment and subsequent item changes through `useCard`, refreshes next runs every 30 seconds and fits the card to its content. Cleanup stops subscriptions, sizing and the timer.
- Card title, tint and height defaults live in `manifest.renderers`; the page is `dist/ui/renderers/cron-renderer/index.html`.
- `src/preview/scenarios/attachmentScenarios.ts` preserves the real sample, derives renderer defaults from the manifest and keeps item attachment references separate from payloads.

The parser accepts wildcards, lists, ranges, steps and named months/weekdays. At least one field must contain a cron special character to avoid false positives. The next-run calculation follows the existing day-of-month/day-of-week OR rule. See [README.md](./README.md) for examples.
