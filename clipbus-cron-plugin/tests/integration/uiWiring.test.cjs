const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const FEATURES = path.join(ROOT, "src", "features");
const HOST_MAIN = path.join(ROOT, "src", "preview", "preview-host", "main.ts");
const OLD_SHELL = path.join(ROOT, "src", "preview", "PreviewShellApp.vue");

const manifest = require("../../manifest.json");

test("preview workbench uses the SDK createPreviewWorkbench (not a hand-rolled shell)", () => {
  assert.ok(!fs.existsSync(OLD_SHELL),
    "PreviewShellApp.vue should be removed after migrating to createPreviewWorkbench");
  const src = fs.readFileSync(HOST_MAIN, "utf8");
  assert.ok(src.includes("createPreviewWorkbench"),
    "preview-host/main.ts must call createPreviewWorkbench from @clipbus/plugin-sdk/preview");
  assert.ok(/from ["']\.\.\/\.\.\/features\/cron-renderer\/app\.vue["']/.test(src),
    "preview-host/main.ts must import the real Cron card");
});

test("every auto/bounded renderer calls autoFit (no clipped cards)", () => {
  for (const renderer of manifest.renderers) {
    const dir = renderer.id;
    const appVue = path.join(FEATURES, dir, "app.vue");
    const src = fs.readFileSync(appVue, "utf8");
    assert.ok(src.includes("useCard(attachment)"),
      `renderer "${dir}" must consume the V2 startup card`);
    assert.ok(/autoFit\(|setHeight\(/.test(src),
      `renderer "${dir}" never calls autoFit/setHeight — card height will clip`);
    if (/autoFit\(/.test(src)) {
      assert.ok(/target:/.test(src),
        `renderer "${dir}" calls autoFit without a target — it observes document.body and runaway-loops setHeight in the preview workbench`);
    }
  }
});
