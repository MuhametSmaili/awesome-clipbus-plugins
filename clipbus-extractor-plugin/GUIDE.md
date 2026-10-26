# Plugin Development Guide (Scaffold Workflow)

*English · [中文](./GUIDE_zh.md)*

This project (`clipbus-extractor-plugin/`) provides six text detectors and their card pages on SDK 2 / plugin protocol V2 (manifest schema 5). This file covers only the **scaffold workflow** (getting started, local development, debugging inside Clipbus, building, testing) and the **project structure**.

**The authoritative knowledge for plugin development** (architecture, manifest, SDK entry points, detector/renderer/action, input shapes, RPC, declared writes, pitfalls) **ships with the SDK package**. After `npm install` it lives in `node_modules/@clipbus/plugin-sdk/docs/` — and always matches the SDK version you currently have installed.

- **AI / tools**: read this project's root [`AGENTS.md`](./AGENTS.md) first; it points to the stable entry point of the SDK docs.
- **Documentation map**: `node_modules/@clipbus/plugin-sdk/docs/README.md`
- **Capability source of truth**: `node_modules/@clipbus/plugin-sdk/API.md` (generated; in case of conflict, it wins)
- Refresh the docs and capabilities via `npm update @clipbus/plugin-sdk` — **no need to replace any file in this project**.

> The code and notes inside this project are **examples** and may lag behind the installed SDK; when they conflict with the SDK docs, **the SDK docs win**.

---

## 0. Quick start

### Prerequisites

- Node.js 26 for the test runner (native TypeScript stripping)

### Initialize

```sh
npm install
```

The dependency `@clipbus/plugin-sdk` is an independently published npm package (third-party projects install it via `npm install @clipbus/plugin-sdk`). `npm install` fetches and compiles the SDK; once it finishes, you can use it directly.

> All symbols available to plugin authors are produced by codegen and listed in the SDK package's `API.md` and `README.md` (see [`@clipbus/plugin-sdk`](https://www.npmjs.com/package/@clipbus/plugin-sdk)). **Plugin authors do not need to view or modify the SDK's internal source.**

### Local development

```sh
npm run dev
```

Starts the SDK V2 Preview Workbench with nine real scenarios across the six renderer cards. Select a sample from the Scenario menu; `?scenario=<id>` restores it after a refresh. Editing `src/features/*/app.vue` hot-reloads the browser.

### Debugging inside Clipbus

Clipbus → Settings → Plugins → the Developer Plugins section provides lifecycle management for development plugins:

1. **Add Path** — select the directory containing `manifest.json` (i.e. the `sourceRootPath`).
2. If `manifest.json` declares an `install` field, Clipbus **runs the install script automatically**, with the working directory set to `sourceRootPath`. Artifacts such as `node_modules/` land in the project directory (equivalent to running `npm install` yourself).
3. Install logs are written to `<AppData>/development-plugins/<pluginID>/install-logs/` and will not pollute your git status.

| Button | Behavior |
|---|---|
| **Reload** | Re-reads `manifest.json`, refreshing fingerprint / writes / loadState. Does **not** re-run install. |
| **Run Install** | Re-runs the install hook in place and updates `lastInstallExecution`. Does **not** re-read the manifest. |
| **View Logs** | Shown in the `installFailed` state; opens the most recent install log (supports live tail). |

States: `installing` → installing; `installFailed` → non-zero exit code or runtime unreachable; `ready` → usable.

### Production build

```sh
npm run build
```

In order: typecheck → lint → clean → build:runtime → build:ui → verify:build, output to `dist/`.

### Verifying your plugin

```sh
npm run verify
```

Runs in order: **manifest validation → build → runtime manifest validation → tests**.

The manifest validation step (`npm run verify:manifest`) checks your `manifest.json`
for structural issues — namespace violations, unsupported schema versions, legacy fields,
unrecognised item types, and more — before the build runs. This catches errors early,
the same ones the host validates at install time.

You can also run manifest validation alone:

```sh
npm run verify:manifest
# or directly via the SDK binary:
npx clipbus-validate-manifest .
npx clipbus-validate-manifest . --runtime  # also checks built file existence
```

### Testing

```sh
npm test         # integration tests under tests/runtime/
```

---

## 1. Project structure

A new plugin is split by feature, each feature a self-contained directory. Recommended layout:

```text
your-plugin/
├── manifest.json
├── package.json                        ← depends on @clipbus/plugin-sdk (npm install)
├── scripts/                            ← build:runtime / build:ui / verify:build
├── src/
│   ├── features/<feature-name>/        ← one folder per capability
│   │   ├── payload.ts                  ← payload types / attachment contract
│   │   ├── detector.ts                 ← detector (if any)
│   │   ├── app.vue                     ← renderer card page
│   │   ├── main.ts / index.html        ← Vite entry
│   ├── shared/                         ← thin utility layer across features
│   ├── preview/                        ← local preview workbench (dev-only)
│   └── plugin.ts                       ← definePlugin entry; registers detector functions
└── tests/runtime/
```

For the six extractor features, see [README.md](./README.md).

> The SDK is a standalone package `@clipbus/plugin-sdk`, synced by codegen — **do not edit it by hand**. To extend capabilities see the package's `SPECIFICATION.md` ([`@clipbus/plugin-sdk`](https://www.npmjs.com/package/@clipbus/plugin-sdk)), Ch 3.

---

## Next steps

That's all for the scaffold workflow. **All the knowledge for implementing a plugin lives in the SDK docs** — see the root [`AGENTS.md`](./AGENTS.md), or open `node_modules/@clipbus/plugin-sdk/docs/README.md` (documentation map) and `node_modules/@clipbus/plugin-sdk/API.md` (capability source of truth) directly.
