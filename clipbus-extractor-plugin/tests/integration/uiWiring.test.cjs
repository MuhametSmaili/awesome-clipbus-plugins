const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../../manifest.json');

const root = path.resolve(__dirname, '../..');
const host = fs.readFileSync(path.join(root, 'src/preview/preview-host/main.ts'), 'utf8');

test('preview workbench mounts every real renderer component', () => {
  assert.ok(host.includes('createPreviewWorkbench'));
  for (const renderer of manifest.renderers) {
    assert.ok(host.includes(`../../features/${renderer.id}/app.vue`), renderer.id);
    assert.ok(host.includes(`"${renderer.id}":`), renderer.id);
  }
  assert.ok(!fs.existsSync(path.join(root, 'src/preview/PreviewShellApp.vue')));
});

test('every renderer uses V2 startup data, scoped autoFit and cleanup', () => {
  for (const renderer of manifest.renderers) {
    const feature = path.join(root, 'src/features', renderer.id);
    const app = fs.readFileSync(path.join(feature, 'app.vue'), 'utf8');
    const main = fs.readFileSync(path.join(feature, 'main.ts'), 'utf8');
    assert.ok(app.includes('useCard(attachment)'), renderer.id);
    assert.match(app, /autoFit\(\{[^}]*target:/, renderer.id);
    assert.ok(app.includes('stopAutoFit?.()'), renderer.id);
    assert.ok(app.includes('unsub?.()'), renderer.id);
    assert.ok(app.includes('ctx.renderer.onButton('), renderer.id);
    assert.ok(main.includes('forwardConsole()'), renderer.id);
    assert.ok(main.includes('reportInputState()'), renderer.id);
  }
});

test('removed regex action has no manifest entry, source or preview scenario module', () => {
  assert.deepEqual(manifest.actions, []);
  assert.ok(!fs.existsSync(path.join(root, 'src/features/regex-tool')));
  assert.ok(!fs.existsSync(path.join(root, 'src/preview/scenarios/actionScenarios.ts')));
});
