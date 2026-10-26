'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PLUGIN_WRITE_LIMITS } = require('@clipbus/plugin-sdk');
const { fakeHost, itemSnapshot, imageContent, manifest, setupPlugin, textContent } = require('../support/plugin.cjs');

const samples = {
  'json-detector': { text: '{"name":"Alice","age":30}', type: 'plugin.formatter.json', scope: 'formatter', label: 'JSON Object' },
  'xml-detector': { text: '<root attr="x"><child/></root>', type: 'plugin.formatter.xml', scope: 'xml', label: 'XML' },
  'csv-detector': { text: 'name,note\nAlice,"handles, UX & motion"', type: 'plugin.formatter.csv', scope: 'csv', label: 'CSV' },
};

test('built detectors write declared attachments and search entries on copy and recopy', async t => {
  const { registry, launch } = await setupPlugin(t);
  assert.deepEqual(Object.keys(registry.detectors).sort(), manifest.detectors.map(d => d.id).sort());
  assert.deepEqual(Object.keys(registry.actions), []);
  assert.deepEqual(manifest.actions, []);
  let attachments = 0;
  let searches = 0;
  for (const [id, sample] of Object.entries(samples)) {
    const writes = [];
    for (const trigger of ['copy', 'recopy']) {
      const host = fakeHost(launch);
      assert.equal(await registry.detectors[id]({ item: itemSnapshot('text'), content: textContent(sample.text), trigger }, host.ctx), undefined);
      const [attachment] = host.paramsOf('item.setAttachments');
      assert.equal(attachment.type, sample.type);
      assert.ok(manifest.writes.attachmentTypes.includes(attachment.type));
      assert.equal(attachment.entries.length, 1);
      const entry = attachment.entries[0];
      assert.equal(entry.key, 'primary');
      assert.equal(entry.payload.version, 1);
      assert.ok(Buffer.byteLength(JSON.stringify(entry.payload)) <= PLUGIN_WRITE_LIMITS.maximumPayloadBytes);
      const [search] = host.paramsOf('item.setSearchExtension');
      assert.equal(search.scope, sample.scope);
      assert.ok(manifest.writes.searchScopes.includes(search.scope));
      assert.equal(search.entries.length, 1);
      assert.equal(search.entries[0].key, 'primary');
      assert.equal(search.entries[0].label, sample.label);
      assert.ok(search.entries[0].text.length > 0);
      assert.ok(Buffer.byteLength(search.entries[0].text) <= PLUGIN_WRITE_LIMITS.maximumSearchTextBytes);
      if (id === 'json-detector') {
        assert.equal(entry.card.title, 'JSON Object');
        assert.deepEqual(JSON.parse(entry.payload.formatted), JSON.parse(sample.text));
        assert.deepEqual(JSON.parse(entry.payload.minified), JSON.parse(sample.text));
        assert.ok(entry.payload.yaml.includes('name: Alice'));
      } else if (id === 'xml-detector') {
        assert.equal(entry.payload.elementCount, 2);
        assert.equal(entry.payload.attributeCount, 1);
        assert.equal(entry.payload.maxDepth, 2);
      } else {
        assert.deepEqual(entry.payload.headers, ['name', 'note']);
        assert.deepEqual(entry.payload.rows, [['Alice', 'handles, UX & motion']]);
        assert.equal(search.entries[0].text, 'name note');
      }
      writes.push(host.calls);
    }
    assert.deepEqual(writes[0], writes[1], id);
    attachments += writes[0].filter(([method]) => method === 'item.setAttachments').length;
    searches += writes[0].filter(([method]) => method === 'item.setSearchExtension').length;
  }
  assert.ok(attachments <= PLUGIN_WRITE_LIMITS.maximumAttachmentsPerItem);
  assert.ok(searches <= PLUGIN_WRITE_LIMITS.maximumSearchEntriesPerItem);
});

test('built JSON detector persists the dynamic array title with its payload', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  await registry.detectors['json-detector']({ item: itemSnapshot('text'), content: textContent('[1,2,3]'), trigger: 'manual' }, host.ctx);
  const [attachment] = host.paramsOf('item.setAttachments');
  assert.equal(attachment.entries[0].card.title, 'JSON Array');
  assert.equal(attachment.entries[0].payload.topLevelCount, 3);
});

test('built detectors produce no writes for nonmatches or image input', async t => {
  const { registry, launch } = await setupPlugin(t);
  for (const detector of Object.values(registry.detectors)) {
    for (const content of [textContent('ordinary unrelated prose'), imageContent]) {
      const host = fakeHost(launch);
      await detector({ item: itemSnapshot(content.kind), content, trigger: 'edit' }, host.ctx);
      assert.deepEqual(host.calls, []);
    }
  }
});

test('CSV search headers respect the byte limit without splitting Unicode', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const header = '😀'.repeat(1500);
  await registry.detectors['csv-detector']({ item: itemSnapshot('text'), content: textContent(`${header},note\nAlice,hello`), trigger: 'copy' }, host.ctx);
  const [search] = host.paramsOf('item.setSearchExtension');
  assert.equal(search.entries[0].text, '😀'.repeat(PLUGIN_WRITE_LIMITS.maximumSearchTextBytes / 4));
  assert.equal(Buffer.byteLength(search.entries[0].text), PLUGIN_WRITE_LIMITS.maximumSearchTextBytes);
  const [attachment] = host.paramsOf('item.setAttachments');
  assert.equal(attachment.entries[0].payload.headers[0], header);
});

test('oversized CSV and expanded XML payloads produce no over-budget writes', async t => {
  const { registry, launch } = await setupPlugin(t);
  const inputs = {
    'csv-detector': `name,note\nAlice,${'x'.repeat(PLUGIN_WRITE_LIMITS.maximumPayloadBytes)}`,
    'xml-detector': '<a>'.repeat(1600) + '</a>'.repeat(1600),
  };
  for (const [id, text] of Object.entries(inputs)) {
    const host = fakeHost(launch);
    await registry.detectors[id]({ item: itemSnapshot('text'), content: textContent(text), trigger: 'copy' }, host.ctx);
    assert.deepEqual(host.calls, [], id);
  }
});
