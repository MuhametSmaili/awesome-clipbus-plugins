'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fakeHost, itemSnapshot, manifest, setupPlugin, textContent } = require('../support/plugin.cjs');
const { PLUGIN_WRITE_LIMITS } = require('@clipbus/plugin-sdk');

const attachmentTypes = {
  'color-detector': 'plugin.preview.color',
  'gradient-detector': 'plugin.preview.gradient',
  'markdown-detector': 'plugin.preview.markdown',
};
const samples = {
  'color-detector': '#3366ff',
  'gradient-detector': 'linear-gradient(to right, red, blue)',
  'markdown-detector': '# Heading\n\n**Bold** with `inline code`',
};

test('built detectors write declared attachments and search entries on copy and recopy', async t => {
  const { registry, launch } = await setupPlugin(t);
  assert.deepEqual(Object.keys(registry.detectors).sort(), manifest.detectors.map(d => d.id).sort());
  let searchCount = 0;
  let attachmentCount = 0;
  for (const [id, text] of Object.entries(samples)) {
    const writes = [];
    for (const trigger of ['copy', 'recopy']) {
      const host = fakeHost(launch);
      const output = await registry.detectors[id]({ item: itemSnapshot('text'), content: textContent(text), trigger }, host.ctx);
      assert.equal(output, undefined);
      const [attachment] = host.paramsOf('item.setAttachments');
      assert.ok(attachment, id);
      assert.ok(manifest.writes.attachmentTypes.includes(attachment.type), id);
      assert.equal(attachment.type, attachmentTypes[id]);
      assert.equal(attachment.entries.length, 1);
      assert.equal(attachment.entries[0].key, 'primary');
      assert.equal(typeof attachment.entries[0].payload, 'object');
      if (id === 'color-detector') assert.equal(attachment.entries[0].card.tint, '#3366FF');
      assert.ok(Buffer.byteLength(JSON.stringify(attachment.entries[0].payload)) <= PLUGIN_WRITE_LIMITS.maximumPayloadBytes);
      const [search] = host.paramsOf('item.setSearchExtension');
      assert.ok(manifest.writes.searchScopes.includes(search.scope), id);
      assert.equal(search.entries.length, 1);
      assert.ok(Buffer.byteLength(search.entries[0].text) <= PLUGIN_WRITE_LIMITS.maximumSearchTextBytes);
      writes.push(host.calls);
    }
    assert.deepEqual(writes[0], writes[1], id);
    attachmentCount += writes[0].filter(([method]) => method === 'item.setAttachments').reduce((count, [, params]) => count + params.entries.length, 0);
    searchCount += writes[0].filter(([method]) => method === 'item.setSearchExtension').length;
  }
  assert.ok(attachmentCount <= PLUGIN_WRITE_LIMITS.maximumAttachmentsPerItem);
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

test('built detectors ignore non-text content and preserve nonmatching zero writes', async t => {
  const { registry, launch } = await setupPlugin(t);
  for (const detector of Object.values(registry.detectors)) {
    const host = fakeHost(launch);
    await detector({ item: itemSnapshot('image'), content: { kind: 'image', width: 1, height: 1, format: 'png', bytes: 0 }, trigger: 'copy' }, host.ctx);
    assert.deepEqual(host.calls, []);
  }
});

test('card appearance is declared and all Draft Actions are absent', async t => {
  const { registry } = await setupPlugin(t);
  assert.deepEqual(manifest.actions, []);
  assert.deepEqual(registry.actions, {});
  const color = manifest.renderers.find(r => r.id === 'color-swatch');
  assert.equal(color.title, 'Color');
  assert.deepEqual(color.buttons, [{ id: 'copy', title: 'Copy All Formats' }]);
  const gradient = manifest.renderers.find(r => r.id === 'gradient-swatch');
  assert.deepEqual(gradient.buttons, [{ id: 'copy-gradient', title: 'Copy Gradient' }]);
  const markdown = manifest.renderers.find(r => r.id === 'markdown-renderer');
  assert.equal(markdown.title, 'Markdown Preview');
  assert.equal(markdown.tint, '#0EA5E9');
});

test('large Markdown never writes a payload above the protocol limit', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const text = '# Heading\n**Bold**\n' + '<&'.repeat(400000);
  await registry.detectors['markdown-detector']({ item: itemSnapshot('text'), content: textContent(text), trigger: 'copy' }, host.ctx);
  assert.deepEqual(host.calls, []);
});
