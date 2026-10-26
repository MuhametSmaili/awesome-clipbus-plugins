'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  fakeHost, itemSnapshot, manifest, setupPlugin, textContent,
} = require('../support/plugin.cjs');

test('built runtime registers exactly the declared Actions and no card or detector handlers', async t => {
  const { registry, launch } = await setupPlugin(t);
  assert.equal(launch.protocol, 2);
  assert.equal(launch.plugin.id, 'plugin.text');
  assert.deepEqual(Object.keys(registry.actions).sort(), manifest.actions.map(a => a.id).sort());
  assert.deepEqual(Object.keys(registry.detectors), []);
  assert.deepEqual(Object.keys(registry.messages), []);
  assert.deepEqual(manifest.renderers, []);
  assert.deepEqual(manifest.detectors, []);
  assert.deepEqual(manifest.writes, { attachmentTypes: [], searchScopes: [] });
});

for (const { id } of manifest.actions) {
  test(`${id} processes the cascaded text value independently of the starting item kind`, async t => {
    const { registry, launch } = await setupPlugin(t);
    const host = fakeHost(launch);
    const item = itemSnapshot('image');
    const before = structuredClone(item);
    const output = await registry.actions[id]({ item, content: textContent('1') }, host.ctx);
    assert.deepEqual(output, { result: { kind: 'text', text: '1' }, message: 'Done' });
    assert.deepEqual(item, before);
    assert.deepEqual(host.calls, []);
  });
}
