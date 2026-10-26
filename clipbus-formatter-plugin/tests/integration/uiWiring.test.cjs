const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../../manifest.json');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('preview workbench mounts every real renderer component and has no action scenarios', () => {
  const main = read('src/preview/preview-host/main.ts');
  assert.ok(main.includes('createPreviewWorkbench'));
  assert.ok(!fs.existsSync(path.join(root, 'src/preview/PreviewShellApp.vue')));
  assert.ok(!fs.existsSync(path.join(root, 'src/preview/scenarios/actionScenarios.ts')));
  assert.ok(!main.includes('actionScenarios'));
  for (const renderer of manifest.renderers) {
    assert.ok(main.includes(`../../features/${renderer.id}/app.vue`), renderer.id);
    assert.ok(main.includes(`"${renderer.id}":`), renderer.id);
  }
});

test('every renderer follows V2 card state, sizes its content and cleans up listeners', () => {
  for (const renderer of manifest.renderers) {
    const src = read(`src/features/${renderer.id}/app.vue`);
    assert.ok(src.includes('useCard(attachment)'), renderer.id);
    assert.ok(src.includes('card.attachment.value.payload'), renderer.id);
    assert.match(src, /autoFit\(\{[^}]*target:/, renderer.id);
    assert.ok(src.includes('stopAutoFit?.()'), renderer.id);
    assert.ok(src.includes('useCardButton('), renderer.id);
    assert.ok(src.includes('ctx.system.copyText'), renderer.id);
    const main = read(`src/features/${renderer.id}/main.ts`);
    assert.ok(main.includes('forwardConsole()'), renderer.id);
    assert.ok(main.includes('reportInputState()'), renderer.id);
  }
});
