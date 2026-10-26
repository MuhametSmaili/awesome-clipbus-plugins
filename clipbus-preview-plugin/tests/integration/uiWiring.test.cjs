const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const manifest = require("../../manifest.json");

test("preview workbench mounts every real renderer component", () => {
  const src = fs.readFileSync(path.join(root, "src/preview/preview-host/main.ts"), "utf8");
  assert.ok(src.includes("createPreviewWorkbench"));
  assert.ok(!fs.existsSync(path.join(root, "src/preview/PreviewShellApp.vue")));
  assert.ok(!fs.existsSync(path.join(root, "src/preview/scenarios/actionScenarios.ts")));
  for (const renderer of manifest.renderers) {
    assert.ok(src.includes(`../../features/${renderer.id}/app.vue`), renderer.id);
    const app = fs.readFileSync(path.join(root, "src/features", renderer.id, "app.vue"), "utf8");
    assert.ok(app.includes("useCard(attachment)"), renderer.id);
    const main = fs.readFileSync(path.join(root, "src/features", renderer.id, "main.ts"), "utf8");
    assert.ok(main.includes("forwardConsole()"), renderer.id);
    assert.ok(main.includes("reportInputState()"), renderer.id);
    if (renderer.height.min !== renderer.height.max) {
      assert.match(main, /autoFit\(/, renderer.id);
      assert.match(main, /target:/, renderer.id);
      assert.match(main, /stopAutoFit\(\)/, renderer.id);
      assert.match(src, /autoFit\(/);
    }
  }
});
