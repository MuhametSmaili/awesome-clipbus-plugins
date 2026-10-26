'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fakeHost, itemSnapshot, manifest, setupPlugin, textContent } = require('../support/plugin.cjs');
const { PLUGIN_WRITE_LIMITS } = require('@clipbus/plugin-sdk');

const samples = {
  'timestamp-detector': '1700000000',
  'radix-detector': '0xff',
  'duration-detector': 'P1D',
  'temperature-detector': '37 C',
  'filesize-detector': '1 KB',
  'chmod-detector': 'rwxr-xr-x',
};

test('built detectors write declared attachments and search entries on copy and recopy', async t => {
  const { registry, launch } = await setupPlugin(t);
  assert.deepEqual(Object.keys(registry.detectors).sort(), manifest.detectors.map(d => d.id).sort());
  let searchCount = 0;
  for (const [id, text] of Object.entries(samples)) {
    const writes = [];
    for (const trigger of ['copy', 'recopy']) {
      const host = fakeHost(launch);
      const output = await registry.detectors[id]({ item: itemSnapshot('text'), content: textContent(text), trigger }, host.ctx);
      assert.equal(output, undefined);
      const [attachment] = host.paramsOf('item.setAttachments');
      assert.ok(attachment, id);
      assert.ok(manifest.writes.attachmentTypes.includes(attachment.type), id);
      assert.equal(attachment.entries.length, 1);
      assert.equal(attachment.entries[0].key, 'primary');
      assert.equal(typeof attachment.entries[0].payload, 'object');
      assert.ok(Buffer.byteLength(JSON.stringify(attachment.entries[0].payload)) <= PLUGIN_WRITE_LIMITS.maximumPayloadBytes);
      const [search] = host.paramsOf('item.setSearchExtension');
      assert.ok(manifest.writes.searchScopes.includes(search.scope), id);
      assert.equal(search.entries.length, 1);
      assert.ok(Buffer.byteLength(search.entries[0].text) <= PLUGIN_WRITE_LIMITS.maximumSearchTextBytes);
      writes.push(host.calls);
    }
    assert.deepEqual(writes[0], writes[1], id);
    searchCount += writes[0].filter(([method]) => method === 'item.setSearchExtension').length;
  }
  assert.ok(searchCount <= PLUGIN_WRITE_LIMITS.maximumSearchEntriesPerItem);
});

test('built detectors produce no writes for nonmatching text', async t => {
  const { registry, launch } = await setupPlugin(t);
  for (const detector of Object.values(registry.detectors)) {
    const host = fakeHost(launch);
    await detector({ item: itemSnapshot('text'), content: textContent('ordinary unrelated prose'), trigger: 'edit' }, host.ctx);
    assert.deepEqual(host.calls, []);
  }
});
