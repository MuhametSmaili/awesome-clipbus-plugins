'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fakeHost, itemSnapshot, manifest, setupPlugin, textContent, imageContent } = require('../support/plugin.cjs');
const { PLUGIN_WRITE_LIMITS } = require('@clipbus/plugin-sdk');

const samples = [
  ['entities-detector', 'https://example.com john@example.com 192.168.1.1', 'plugin.extractor.entities', 'extractor', 'Extracted Entities'],
  ['url-detector', 'https://example.com/?utm_source=email&id=42', 'plugin.extractor.url', 'url', 'URL'],
  ['url-detector', 'tag=one&tag=two&lang=zh-CN', 'plugin.extractor.url', 'query', 'Query String'],
  ['ip-detector', '192.168.1.10', 'plugin.extractor.ip', 'extractor', 'IP Address'],
  ['geo-detector', '37.7749, -122.4194', 'plugin.extractor.geo', 'extractor', 'Coordinates'],
  ['mac-detector', '00:1A:2B:3C:4D:5E', 'plugin.extractor.mac', 'extractor', 'MAC Address'],
  ['uuid-detector', '550e8400-e29b-41d4-a716-446655440000', 'plugin.extractor.uuid', 'extractor', 'UUID'],
];

test('built detectors write declared structured attachments and search entries on copy and recopy', async t => {
  const { registry, launch } = await setupPlugin(t);
  assert.deepEqual(Object.keys(registry.detectors).sort(), manifest.detectors.map(d => d.id).sort());
  assert.deepEqual(Object.keys(registry.actions), []);
  for (const [id, text, type, scope, label] of samples) {
    const writes = [];
    for (const trigger of ['copy', 'recopy']) {
      const host = fakeHost(launch);
      const output = await registry.detectors[id]({ item: itemSnapshot('text'), content: textContent(text), trigger }, host.ctx);
      assert.equal(output, undefined);
      const [attachment] = host.paramsOf('item.setAttachments');
      assert.equal(attachment.type, type);
      assert.ok(manifest.writes.attachmentTypes.includes(type));
      assert.equal(attachment.entries.length, 1);
      assert.equal(attachment.entries[0].key, 'primary');
      assert.equal(typeof attachment.entries[0].payload, 'object');
      assert.ok(Buffer.byteLength(JSON.stringify(attachment.entries[0].payload)) <= PLUGIN_WRITE_LIMITS.maximumPayloadBytes);
      const [search] = host.paramsOf('item.setSearchExtension');
      assert.equal(search.scope, scope);
      assert.ok(manifest.writes.searchScopes.includes(scope));
      assert.equal(search.entries.length, 1);
      assert.equal(search.entries[0].key, 'primary');
      assert.equal(search.entries[0].label, label);
      assert.ok(search.entries[0].text.length > 0);
      assert.ok(Buffer.byteLength(search.entries[0].text) <= PLUGIN_WRITE_LIMITS.maximumSearchTextBytes);
      writes.push(host.calls);
    }
    assert.deepEqual(writes[0], writes[1], id);
  }
  // Every detector writes at most one attachment and one search entry per item.
  assert.ok(manifest.detectors.length <= PLUGIN_WRITE_LIMITS.maximumAttachmentsPerItem);
  assert.ok(manifest.detectors.length <= PLUGIN_WRITE_LIMITS.maximumSearchEntriesPerItem);
});

test('built detectors produce no writes for nonmatching text or image input', async t => {
  const { registry, launch } = await setupPlugin(t);
  for (const detector of Object.values(registry.detectors)) {
    for (const content of [textContent('ordinary unrelated prose'), imageContent]) {
      const host = fakeHost(launch);
      await detector({ item: itemSnapshot(content.kind), content, trigger: 'edit' }, host.ctx);
      assert.deepEqual(host.calls, []);
    }
  }
});

test('URL cards preserve query titles and tracker-dependent copy buttons before page load', async t => {
  const { registry, launch } = await setupPlugin(t);
  for (const [text, title, ids] of [
    ['tag=one&tag=two', 'Query String', ['copy']],
    ['https://example.com/?id=42', 'URL Details', ['copy']],
    ['https://example.com/?utm_source=email&id=42', 'URL Details', ['copy-clean', 'copy']],
  ]) {
    const host = fakeHost(launch);
    await registry.detectors['url-detector']({ item: itemSnapshot('text'), content: textContent(text), trigger: 'copy' }, host.ctx);
    const [attachment] = host.paramsOf('item.setAttachments');
    const { payload, card } = attachment.entries[0];
    assert.equal(card.title, title);
    assert.deepEqual(card.buttons.map(button => button.id), ids);
    if (ids.includes('copy-clean')) assert.equal(payload.cleanHref, 'https://example.com/?id=42');
  }
});

test('long multibyte query search stays within byte limits while the payload retains every value', async t => {
  const { registry, launch } = await setupPlugin(t);
  const value = '你'.repeat(4000);
  const host = fakeHost(launch);
  await registry.detectors['url-detector']({ item: itemSnapshot('text'), content: textContent(`q=${encodeURIComponent(value)}&b=2`), trigger: 'copy' }, host.ctx);
  const [attachment] = host.paramsOf('item.setAttachments');
  assert.equal(attachment.entries[0].payload.query[0].value, value);
  const [search] = host.paramsOf('item.setSearchExtension');
  assert.equal(search.scope, 'query');
  assert.ok(Buffer.byteLength(search.entries[0].text) <= PLUGIN_WRITE_LIMITS.maximumSearchTextBytes);
});

test('URL results exceeding the payload byte limit produce no partial writes', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  await registry.detectors['url-detector']({ item: itemSnapshot('text'), content: textContent(`https://example.com/?q=${'x'.repeat(600000)}`), trigger: 'copy' }, host.ctx);
  assert.deepEqual(host.calls, []);
});
