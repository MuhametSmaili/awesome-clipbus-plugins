'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const manifest = require('../../manifest.json');

const root = path.resolve(__dirname, '../..');

test('the headless text plugin has no card or action preview scenarios', () => {
  assert.deepEqual(manifest.renderers, []);
  assert.equal(manifest.actions.length, 9);
  for (const action of manifest.actions) {
    assert.equal(action.page, undefined, action.id);
    assert.equal(action.lifecycle, undefined, action.id);
  }
  assert.equal(fs.existsSync(path.join(root, 'src/preview/scenarios/actionScenarios.ts')), false);
});

test('the actual Text Tools guidance preview builds with its real entry and styles', async t => {
  const { build } = await import('vite');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'clipbus-text-preview-'));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  await build({
    root,
    configFile: path.join(root, 'vite.config.mjs'),
    logLevel: 'silent',
    build: {
      outDir: scratch,
      emptyOutDir: true,
      rollupOptions: { input: path.join(root, 'src/preview/preview-host/index.html') },
    },
  });
  const html = fs.readFileSync(path.join(scratch, 'src/preview/preview-host/index.html'), 'utf8');
  assert.match(html, /<title>Text Tools Preview<\/title>/);
  const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(match => match[1]);
  assert.equal(assets.filter(asset => asset.endsWith('.js')).length, 1);
  assert.equal(assets.filter(asset => asset.endsWith('.css')).length, 1);
  for (const asset of assets) {
    assert.ok(fs.statSync(path.join(scratch, asset)).size > 0, asset);
  }
});
