# Vibe Plugin Development Guide

*English · [中文](./GUIDE_zh.md)*

This directory is the Vibe plugin. It targets `@clipbus/plugin-sdk ^2.0.0`, plugin protocol V2 and manifest schema 5. Read [AGENTS.md](./AGENTS.md), then the installed SDK's `docs/README.md` and `API.md`. The installed API reference takes precedence over repository examples. Do not inspect or modify SDK implementation source.

## Install and preview

Use the Node version required by the installed SDK. Run these commands in `clipbus-vibe-plugin/`:

```sh
npm install
npm run dev
```

The SDK preview workbench mounts the actual Vibe Vue component and Three.js animations. Its four scenarios retain the original plain-text and short-word examples and demonstrate an ordered animation list and a single-animation setting. The workbench provides theme and width controls, the native card shell and buttons, startup snapshots and a host-call log.

Settings in a preview scenario use the plugin-local shape:

```ts
settings: { animations: ["text-loop", "particle-core"] }
```

The host stores the same setting under `plugin.vibe.animations`. `ctx.settings.get<{ animations?: unknown }>()` returns `{ values }`; read `values.animations`. See [README.md](./README.md) for the host file location and animation behavior.

## Runtime and card wiring

The detector reads `input.item.attachments`, whose entries are references `{ type, key, updatedAt, own }`. Foreign references cause the detector to yield without writing. Own references allow a complete write on recopy. Successful no-write calls clear the detector's previous output. The snapshot check cannot account for another detector's later writes until the next detection.

`payload.ts` defines the typed attachment contract and pure payload functions. The detector awaits `vibeAttachment.set(ctx, [{ key, payload }])`. Its type is declared in `writes.attachmentTypes`; Vibe writes no search extensions.

The manifest declares the renderer page, title, tint, buttons and fixed height `{ min: 220, max: 220 }`. Cards have no Runtime registry entry. The page imports `ctx` from `@clipbus/plugin-sdk/view` and uses `useCard(vibeAttachment)` for startup data and item/environment events. It publishes buttons through `ctx.renderer.update` and reads `event.id` from `ctx.renderer.onButton`. Unmounting cancels subscriptions and disposes the active animation.

## Build and verify

```sh
npm run verify
```

This runs manifest validation, type checking, lint, Runtime/UI builds, build wiring checks, built-manifest validation and Node tests. Tests preserve payload and animation-switching vectors, run the built detector through `tests/support/plugin.cjs`, and validate real V2 scenarios with the SDK's `computeBootstrap`.

`npm run build` rebuilds `dist/` in this directory, which is the path Clipbus loads. `npm test` requires built Runtime artifacts. The shared UI build and verification scripts are manifest-driven; changes to shared infrastructure belong in the repository's maintained sources.

## Debug inside Clipbus

1. Open Settings → Plugins → Developer Plugins → Add Path and select this directory.
2. Reload rereads the manifest. Run Install reruns the installation hook.
3. After source edits, rebuild this directory's `dist/` and reload. Verify cross-plugin detection ordering in the actual host.

## Files

- `manifest.json`: plugin identity, declared writes, detector and card defaults.
- `src/plugin.ts`: Runtime detector registration.
- `src/features/vibe-fallback/`: payload contract, detector, card, switching logic and the three animation implementations.
- `src/shared/composables/useCard.ts`: shared V2 card subscriptions.
- `src/preview/`: real preview scenarios and component mounting.
- `tests/runtime/`, `tests/integration/`, `tests/support/`: business checks, preview validation and Runtime harness.
