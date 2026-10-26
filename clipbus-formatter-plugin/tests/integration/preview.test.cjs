'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');
const { computeBootstrap } = require('@clipbus/plugin-sdk/preview');
const root = path.resolve(__dirname, '../..');
const manifest = require('../../manifest.json');

test('every renderer has a real V2 scenario accepted by the SDK preview bootstrap', t => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'clipbus-preview-test-'));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const outfile = path.join(scratch, 'scenarios.cjs');
  buildSync({ entryPoints: [path.join(root, 'src/preview/scenarios/attachmentScenarios.ts')], outfile, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
  const { attachmentScenarios } = require(outfile);
  assert.ok(attachmentScenarios.length >= manifest.renderers.length);
  for (const renderer of manifest.renderers) {
    const scenarios = attachmentScenarios.filter(s => s.attachment.type === renderer.attachmentType);
    assert.ok(scenarios.length > 0, renderer.id);
    for (const scenario of scenarios) {
      const bootstrap = computeBootstrap(scenario);
      assert.equal(bootstrap.protocol, 2);
      assert.equal(bootstrap.context.plugin.id, manifest.plugin.id);
      assert.equal(typeof bootstrap.context.attachment.payload, 'object');
      assert.equal(scenario.renderer.title, renderer.title);
      assert.deepEqual(scenario.renderer.buttons, renderer.buttons);
      assert.equal(scenario.renderer.tint, renderer.tint);
      assert.deepEqual(scenario.height, renderer.height);
      assert.equal(scenario.view, renderer.id);
      assert.equal(bootstrap.context.item.kind, 'text');
      assert.ok(scenario.item.attachments.some(reference => reference.type === scenario.attachment.type && reference.key === scenario.attachment.key));
      for (const reference of scenario.item.attachments) {
        assert.deepEqual(Object.keys(reference).sort(), ['key', 'own', 'type', 'updatedAt']);
      }
    }
  }
});
