'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PLUGIN_INPUT_LIMITS, PLUGIN_WRITE_LIMITS } = require('@clipbus/plugin-sdk');
const { fakeHost, itemSnapshot, manifest, setupPlugin, textContent, imageContent } = require('../support/plugin.cjs');

const jwt = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"sub":"123","name":"John Doe"}').toString('base64url')}.sig`;
const samples = {
  'base64-detector': { text: 'SGVsbG8sIFdvcmxkIQ==', type: 'plugin.decoder.base64', scope: 'decoder', search: 'Hello, World!', label: 'Base64 Decoded' },
  'jwt-detector': { text: jwt, type: 'plugin.decoder.jwt', scope: 'jwt', search: '{\n  "sub": "123",\n  "name": "John Doe"\n}', label: 'JWT' },
  'data-uri-detector': { text: 'data:text/plain;base64,SGVsbG8=', type: 'plugin.decoder.datauri', scope: 'decoder', search: 'data uri text/plain Base64', label: 'Data URI' },
};

test('built detectors write declared attachments and searches for copy and recopy', async t => {
  const { registry, launch } = await setupPlugin(t);
  assert.deepEqual(Object.keys(registry.detectors).sort(), manifest.detectors.map(d => d.id).sort());
  assert.deepEqual([...manifest.writes.attachmentTypes].sort(), Object.values(samples).map(s => s.type).sort());
  assert.deepEqual([...manifest.writes.searchScopes].sort(), ['decoder', 'jwt']);
  for (const [id, sample] of Object.entries(samples)) {
    const runs = [];
    for (const trigger of ['copy', 'recopy']) {
      const host = fakeHost(launch);
      assert.equal(await registry.detectors[id]({ item: itemSnapshot('text'), content: textContent(sample.text), trigger }, host.ctx), undefined);
      const attachments = host.paramsOf('item.setAttachments');
      assert.equal(attachments.length, 1, id);
      assert.equal(attachments[0].type, sample.type);
      assert.equal(attachments[0].entries.length, 1);
      assert.equal(attachments[0].entries[0].key, 'primary');
      const payload = attachments[0].entries[0].payload;
      assert.equal(typeof payload, 'object');
      assert.ok(Buffer.byteLength(JSON.stringify(payload)) <= PLUGIN_WRITE_LIMITS.maximumPayloadBytes);
      if (id === 'base64-detector') assert.equal(payload.decoded, 'Hello, World!');
      if (id === 'jwt-detector') assert.equal(payload.alg, 'HS256');
      if (id === 'data-uri-detector') assert.equal(payload.decodedTextPreview, 'Hello');
      assert.deepEqual(host.paramsOf('item.setSearchExtension'), [{ scope: sample.scope, entries: [{ key: 'primary', text: sample.search, label: sample.label }] }]);
      runs.push(host.calls);
    }
    assert.deepEqual(runs[0], runs[1], id);
  }
});

test('built detectors make no writes for unrelated text or image input', async t => {
  const { registry, launch } = await setupPlugin(t);
  for (const detector of Object.values(registry.detectors)) {
    for (const content of [textContent('ordinary unrelated prose'), imageContent]) {
      const host = fakeHost(launch);
      await detector({ item: itemSnapshot(content.kind), content, trigger: 'edit' }, host.ctx);
      assert.deepEqual(host.calls, []);
    }
  }
});

test('all detector outputs together stay within the per-item write limits', async t => {
  const { registry, launch } = await setupPlugin(t);
  for (const sample of Object.values(samples)) {
    const host = fakeHost(launch);
    for (const detector of Object.values(registry.detectors)) {
      await detector({ item: itemSnapshot('text'), content: textContent(sample.text), trigger: 'manual' }, host.ctx);
    }
    const attachments = host.paramsOf('item.setAttachments').flatMap(p => p.entries);
    const searches = host.paramsOf('item.setSearchExtension').flatMap(p => p.entries);
    assert.ok(attachments.length <= PLUGIN_WRITE_LIMITS.maximumAttachmentsPerItem);
    assert.ok(searches.length <= PLUGIN_WRITE_LIMITS.maximumSearchEntriesPerItem);
    assert.ok(searches.every(e => Buffer.byteLength(e.text) <= PLUGIN_WRITE_LIMITS.maximumSearchTextBytes));
  }
});

test('a long data URI media type keeps search text within the byte limit', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  await registry.detectors['data-uri-detector']({ item: itemSnapshot('text'), content: textContent(`data:text/plain;name=${'界'.repeat(5000)},Hello`), trigger: 'copy' }, host.ctx);
  assert.equal(host.paramsOf('item.setAttachments')[0].entries[0].payload.decodedTextPreview, 'Hello');
  assert.ok(Buffer.byteLength(host.paramsOf('item.setSearchExtension')[0].entries[0].text) <= PLUGIN_WRITE_LIMITS.maximumSearchTextBytes);
});

test('JWT detector avoids oversized attachments after pretty-print expansion', async t => {
  let nested = { value: 'x' };
  for (let i = 0; i < 32; i++) nested = { child: nested };
  const claims = { data: Array(1000).fill(nested) };
  const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
  assert.ok(Buffer.byteLength(token) < PLUGIN_INPUT_LIMITS.maximumTextBytes);
  const { createJwtPayload } = require('../../src/features/jwt-renderer/payload.ts');
  assert.ok(Buffer.byteLength(JSON.stringify(createJwtPayload({ content: textContent(token) }))) > PLUGIN_WRITE_LIMITS.maximumPayloadBytes);
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  await registry.detectors['jwt-detector']({ item: itemSnapshot('text'), content: textContent(token), trigger: 'copy' }, host.ctx);
  assert.deepEqual(host.calls, []);
});

test('Data URI detector avoids oversized attachments after JSON escaping', async t => {
  const text = `data:${'"'.repeat(PLUGIN_INPUT_LIMITS.maximumTextBytes - 6)},`;
  assert.ok(Buffer.byteLength(text) <= PLUGIN_INPUT_LIMITS.maximumTextBytes);
  const { createDataUriPayload } = require('../../src/features/data-uri/payload.ts');
  assert.ok(Buffer.byteLength(JSON.stringify(createDataUriPayload({ content: textContent(text) }))) > PLUGIN_WRITE_LIMITS.maximumPayloadBytes);
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  await registry.detectors['data-uri-detector']({ item: itemSnapshot('text'), content: textContent(text), trigger: 'copy' }, host.ctx);
  assert.deepEqual(host.calls, []);
});

test('built actions preserve all ten transformations and return V2 results', async t => {
  const { registry, launch } = await setupPlugin(t);
  assert.deepEqual(Object.keys(registry.actions).sort(), manifest.actions.map(a => a.id).sort());
  const cases = [
    ['url-encode', 'a b&c', 'a%20b%26c', 'URL encoded'],
    ['url-decode', 'a%20b%26c', 'a b&c', 'URL decoded'],
    ['html-encode', '<b>&</b>', '&lt;b&gt;&amp;&lt;/b&gt;', 'HTML encoded'],
    ['html-decode', '&lt;b&gt;&amp;&lt;/b&gt;', '<b>&</b>', 'HTML decoded'],
    ['base64-encode', '你好', '5L2g5aW9', 'Base64 encoded'],
    ['base64-decode', '5L2g5aW9', '你好', 'Base64 decoded'],
    ['unicode-escape', 'A你', '\\u0041\\u4F60', 'Unicode escaped'],
    ['unicode-unescape', '\\u0041\\u4f60', 'A你', 'Unicode unescaped'],
    ['json-escape', 'say "hi"', 'say \\"hi\\"', 'JSON escaped'],
    ['json-unescape', 'say \\"hi\\"', 'say "hi"', 'JSON unescaped'],
  ];
  for (const [id, input, expected, message] of cases) {
    const host = fakeHost(launch);
    const output = await registry.actions[id]({ item: itemSnapshot('text'), content: textContent(input) }, host.ctx);
    assert.deepEqual(output, { result: { kind: 'text', text: expected }, message }, id);
    assert.deepEqual(host.calls, [], id);
    assert.deepEqual(await registry.actions[id]({ item: itemSnapshot('image'), content: imageContent }, host.ctx), { result: { kind: 'none' }, message: 'Text input required' }, id);
  }
});
