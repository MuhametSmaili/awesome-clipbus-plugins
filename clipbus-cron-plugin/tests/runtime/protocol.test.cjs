'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PLUGIN_WRITE_LIMITS } = require('@clipbus/plugin-sdk');
const { fakeHost, imageContent, itemSnapshot, manifest, setupPlugin, textContent } = require('../support/plugin.cjs');
const { createCronPayload } = require('../../src/features/cron-renderer/payload.ts');

test('built cron detector writes declared payload and search entries on every trigger', async t => {
  const { registry, launch } = await setupPlugin(t);
  assert.equal(launch.protocol, 2);
  assert.deepEqual(Object.keys(registry.detectors), manifest.detectors.map(d => d.id));
  assert.deepEqual(Object.keys(registry.actions), []);
  for (const text of ['30 9 * * 1-5', '*/15 * * * *', '0 8 * * MON-FRI', '0 0 1 JAN-MAR *']) {
    const writes = [];
    const expected = createCronPayload({ content: textContent(text) });
    for (const trigger of ['copy', 'recopy', 'edit', 'manual']) {
      const host = fakeHost(launch);
      const output = await registry.detectors['cron-detector']({ item: itemSnapshot('text'), content: textContent(text), trigger }, host.ctx);
      assert.equal(output, undefined);
      assert.deepEqual(host.methods(), ['item.setAttachments', 'item.setSearchExtension']);
      const [attachment] = host.paramsOf('item.setAttachments');
      assert.ok(manifest.writes.attachmentTypes.includes(attachment.type));
      assert.deepEqual(attachment.entries, [{ key: 'primary', payload: expected }]);
      assert.ok(attachment.entries.length <= PLUGIN_WRITE_LIMITS.maximumAttachmentsPerItem);
      assert.ok(Buffer.byteLength(JSON.stringify(expected)) <= PLUGIN_WRITE_LIMITS.maximumPayloadBytes);
      const [search] = host.paramsOf('item.setSearchExtension');
      assert.ok(manifest.writes.searchScopes.includes(search.scope));
      assert.deepEqual(search.entries, [{ key: 'primary', text: `${expected.expression} ${expected.summary}`, label: 'Cron' }]);
      assert.ok(search.entries.length <= PLUGIN_WRITE_LIMITS.maximumSearchEntriesPerItem);
      assert.ok(Buffer.byteLength(search.entries[0].text) <= PLUGIN_WRITE_LIMITS.maximumSearchTextBytes);
      writes.push(host.calls);
    }
    assert.deepEqual(writes[0], writes[1]);
    assert.deepEqual(writes[0], writes[2]);
    assert.deepEqual(writes[0], writes[3]);
  }
});

test('built detector makes no empty writes for nonmatches or images', async t => {
  const { registry, launch } = await setupPlugin(t);
  for (const content of [textContent('hello world foo bar baz'), textContent('1 2 3 4'), textContent('99 9 * * *'), textContent('1 2 3 4 5'), imageContent]) {
    const host = fakeHost(launch);
    await registry.detectors['cron-detector']({ item: itemSnapshot(content.kind), content, trigger: 'copy' }, host.ctx);
    assert.deepEqual(host.calls, []);
  }
});

test('long valid input preserves the complete payload and bounds search text', async t => {
  const { registry, launch } = await setupPlugin(t);
  const text = `${'0'.repeat(2000)} * * * *`;
  const host = fakeHost(launch);
  await registry.detectors['cron-detector']({ item: itemSnapshot('text'), content: textContent(text), trigger: 'copy' }, host.ctx);
  assert.equal(host.paramsOf('item.setAttachments')[0].entries[0].payload.expression, text);
  const [search] = host.paramsOf('item.setSearchExtension');
  assert.ok(search.entries[0].text.length > 0);
  assert.ok(Buffer.byteLength(search.entries[0].text) <= PLUGIN_WRITE_LIMITS.maximumSearchTextBytes);
});

test('oversized payload is rejected before any writes', async t => {
  const { registry, launch } = await setupPlugin(t);
  const text = `${'0'.repeat(750000)} * * * *`;
  const payload = createCronPayload({ content: textContent(text) });
  assert.ok(Buffer.byteLength(JSON.stringify(payload)) > PLUGIN_WRITE_LIMITS.maximumPayloadBytes);
  const host = fakeHost(launch);
  await registry.detectors['cron-detector']({ item: itemSnapshot('text'), content: textContent(text), trigger: 'copy' }, host.ctx);
  assert.deepEqual(host.calls, []);
});
