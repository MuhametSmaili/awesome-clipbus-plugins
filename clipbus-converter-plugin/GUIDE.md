# Converter Development Guide

This plugin uses SDK 2.x, plugin protocol V2 and manifest schema 5.

Run commands inside this directory:

```sh
npm install
npm run dev
npm run verify
```

The preview workbench contains six real card scenarios. Its renderer defaults come from manifest.json; the pages mount the same Vue components shipped to Clipbus. Case Actions run in the Runtime and have no card preview.

Read node_modules/@clipbus/plugin-sdk/docs/README.md and API.md before changing interfaces. Runtime detectors write attachments and search entries through ctx; Actions return result.text/none. Card pages use /view ctx and the shared useCard binding. Shared contracts stay browser-safe.

Generic UI build and verification scripts come from the repository generator assets; scripts/ui-pages.mjs plans distinct output folders. The complete verify command validates manifest and actual built files, checks types/lint, builds and runs business plus protocol/preview tests.

Clipbus loads dist/. Reloading source alone does not rebuild it: run npm run verify in this actual plugin path before reloading the developer plugin. Browser preview does not reproduce real file/system operations or Host commit validation.
