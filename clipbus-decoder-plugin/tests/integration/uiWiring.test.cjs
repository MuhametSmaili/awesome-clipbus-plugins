const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const FEATURES = path.join(ROOT, "src", "features");
const HOST_MAIN = path.join(ROOT, "src", "preview", "preview-host", "main.ts");
const OLD_SHELL = path.join(ROOT, "src", "preview", "PreviewShellApp.vue");

// Renderers intentionally using a fixed numeric manifest height (no autoFit needed).
// PER-PLUGIN: e.g. preview → ["color-swatch","gradient-swatch"]; else [].
const FIXED_HEIGHT = new Set([]);
// PER-PLUGIN: false only for plugins with no renderer (text).
const HAS_PREVIEWABLE_UI = true;

test("preview workbench uses the SDK createPreviewWorkbench (not a hand-rolled shell)", () => {
  assert.ok(!fs.existsSync(OLD_SHELL),
    "PreviewShellApp.vue should be removed after migrating to createPreviewWorkbench");
  const src = fs.readFileSync(HOST_MAIN, "utf8");
  assert.ok(src.includes("createPreviewWorkbench"),
    "preview-host/main.ts must call createPreviewWorkbench from @clipbus/plugin-sdk/preview");
  if (HAS_PREVIEWABLE_UI) {
    assert.ok(/from ["']\.\.\/\.\.\/features\//.test(src),
      "preview-host/main.ts imports no real feature component");
  }
});

test("every auto/bounded renderer calls autoFit (no clipped cards)", () => {
  if (!fs.existsSync(FEATURES)) return;
  for (const dir of fs.readdirSync(FEATURES)) {
    const appVue = path.join(FEATURES, dir, "app.vue");
    if (!fs.existsSync(appVue)) continue;
    const src = fs.readFileSync(appVue, "utf8");
    if (!src.includes("useCard(")) continue; // not a renderer
    if (FIXED_HEIGHT.has(dir)) continue;
    assert.ok(/autoFit\(|setHeight\(/.test(src),
      `renderer "${dir}" never calls autoFit/setHeight — card height will clip`);
    if (/autoFit\(/.test(src)) {
      assert.ok(/target:/.test(src),
        `renderer "${dir}" calls autoFit without a target — it observes document.body and runaway-loops setHeight in the preview workbench`);
    }
  }
});
