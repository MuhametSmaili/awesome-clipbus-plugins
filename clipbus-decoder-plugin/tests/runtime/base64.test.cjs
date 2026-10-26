'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.resolve(root, 'manifest.json'), 'utf8'));

const sampleItem = {
  id: 'item-1',
  kind: 'text',
  tags: [],
  sourceApp: 'com.example.app',
};

// ---------------------------------------------------------------------------
// Manifest shape
// ---------------------------------------------------------------------------

test('manifest has base64-detector', () => {
  const ids = manifest.detectors.map((d) => d.id);
  assert.ok(ids.includes('base64-detector'), 'missing base64-detector');
});

test('manifest has base64-renderer', () => {
  const ids = manifest.renderers.map((r) => r.id);
  assert.ok(ids.includes('base64-renderer'), 'missing base64-renderer');
});

test('base64-renderer page references renderers/ path', () => {
  const renderer = manifest.renderers.find((r) => r.id === 'base64-renderer');
  assert.ok(renderer.page.startsWith('dist/ui/renderers/'), `unexpected page: ${renderer.page}`);
});

// ---------------------------------------------------------------------------
// Detector / payload
// ---------------------------------------------------------------------------

test('detector detects SGVsbG8sIFdvcmxkIQ== and returns correct decoded text', async () => {
  const { attachment, createBase64Payload } = require(path.resolve(root, 'src/features/base64-renderer/payload.ts'));
  const input = { item: sampleItem, content: { kind: 'text', text: 'SGVsbG8sIFdvcmxkIQ==' }, attachments: [] };
  const artifact = createBase64Payload(input);
  assert.ok(artifact, 'artifact should not be null for valid base64');
  assert.equal(attachment.type, 'plugin.decoder.base64');
  const payload = artifact;
  assert.equal(payload.kind, 'base64_preview');
  assert.equal(payload.decoded, 'Hello, World!');
  assert.equal(payload.encoding, 'standard');
});

test('detector decodes URL-safe base64 (SGVsbG8_ → Hello?)', async () => {
  const { createBase64Payload } = require(path.resolve(root, 'src/features/base64-renderer/payload.ts'));
  // "Hello?" in standard base64 is "SGVsbG8/" — URL-safe replaces / with _: "SGVsbG8_"
  const input = { item: sampleItem, content: { kind: 'text', text: 'SGVsbG8_' }, attachments: [] };
  const artifact = createBase64Payload(input);
  assert.ok(artifact, 'should detect URL-safe base64');
  const payload = artifact;
  assert.equal(payload.encoding, 'url-safe');
  assert.equal(payload.decoded, 'Hello?');
});

test('detector accepts readable multilingual UTF-8 text', () => {
  const { createBase64Payload } = require(path.resolve(root, 'src/features/base64-renderer/payload.ts'));
  const input = { item: sampleItem, content: { kind: 'text', text: '5L2g5aW977yM5LiW55WM77yB' }, attachments: [] };
  const artifact = createBase64Payload(input);
  assert.ok(artifact, 'readable non-ASCII UTF-8 should be detected as base64');
  assert.equal(artifact.decoded, '你好，世界！');
});

test('detector rejects base64-shaped text that decodes to invalid UTF-8', () => {
  const { createBase64Payload } = require(path.resolve(root, 'src/features/base64-renderer/payload.ts'));
  const input = { item: sampleItem, content: { kind: 'text', text: 'abcdefghijklmnopqrstuvwx' }, attachments: [] };
  assert.equal(createBase64Payload(input), null, 'garbled replacement characters are not readable text');
});

test('detector rejects base64 that decodes to control-character data', () => {
  const { createBase64Payload } = require(path.resolve(root, 'src/features/base64-renderer/payload.ts'));
  const input = { item: sampleItem, content: { kind: 'text', text: 'AAAAAAAAAAAAAAAAAAAAAAAA' }, attachments: [] };
  assert.equal(createBase64Payload(input), null, 'binary control data is not readable text');
});

test('detector ignores plain English text', () => {
  const { createBase64Payload } = require(path.resolve(root, 'src/features/base64-renderer/payload.ts'));
  const artifact = createBase64Payload({ item: sampleItem, content: { kind: 'text', text: 'hello world foo bar' }, attachments: [] });
  assert.equal(artifact, null, 'plain text should not be detected as base64');
});

test('detector ignores short strings', () => {
  const { createBase64Payload } = require(path.resolve(root, 'src/features/base64-renderer/payload.ts'));
  const artifact = createBase64Payload({ item: sampleItem, content: { kind: 'text', text: 'abc=' }, attachments: [] });
  assert.equal(artifact, null, 'short string should be ignored');
});

test('detector ignores image content kind', () => {
  const { createBase64Payload } = require(path.resolve(root, 'src/features/base64-renderer/payload.ts'));
  const artifact = createBase64Payload({ item: sampleItem, content: { kind: 'image', width: 100, height: 100, format: 'png', bytes: 0 }, attachments: [] });
  assert.equal(artifact, null, 'image kind should not produce base64 artifact');
});

test('decodeBase64Payload returns null for non-base64-preview payloads', () => {
  const { decodeBase64Payload } = require(path.resolve(root, 'src/features/base64-renderer/payload.ts'));
  assert.equal(decodeBase64Payload('not-json'), null);
  assert.equal(decodeBase64Payload('{"kind":"other"}'), null);
  assert.equal(decodeBase64Payload(null), null);
  assert.equal(decodeBase64Payload(undefined), null);
});


test('decodeBase64Payload accepts structured V2 attachment payloads', () => {
  const { createBase64Payload, decodeBase64Payload } = require(path.resolve(root, 'src/features/base64-renderer/payload.ts'));
  const payload = createBase64Payload({ content: { kind: 'text', text: 'SGVsbG8sIFdvcmxkIQ==' } });
  assert.ok(payload);
  assert.deepEqual(decodeBase64Payload(payload), payload);
  assert.deepEqual(decodeBase64Payload(JSON.stringify(payload)), payload);
});
