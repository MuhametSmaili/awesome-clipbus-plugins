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

function makeInput(text) {
  return { item: sampleItem, content: { kind: 'text', text }, attachments: [] };
}

// ---------------------------------------------------------------------------
// Manifest shape
// ---------------------------------------------------------------------------

test('manifest has data-uri-detector', () => {
  const ids = manifest.detectors.map((d) => d.id);
  assert.ok(ids.includes('data-uri-detector'), 'missing data-uri-detector');
});

test('manifest has data-uri renderer', () => {
  const ids = manifest.renderers.map((r) => r.id);
  assert.ok(ids.includes('data-uri'), 'missing data-uri renderer');
});

test('data-uri renderer page references renderers/ path', () => {
  const renderer = manifest.renderers.find((r) => r.id === 'data-uri');
  assert.ok(renderer.page.startsWith('dist/ui/renderers/'), `unexpected page: ${renderer.page}`);
});

test('manifest declares writes for plugin.decoder.datauri', () => {
  assert.ok(manifest.writes.attachmentTypes.includes('plugin.decoder.datauri'));
});

test('data-uri renderer attachmentType is plugin.decoder.datauri', () => {
  const renderer = manifest.renderers.find((r) => r.id === 'data-uri');
  assert.equal(renderer.attachmentType, 'plugin.decoder.datauri');
});

// ---------------------------------------------------------------------------
// Detector fires on valid data URIs
// ---------------------------------------------------------------------------

test('fires on data:text/plain;base64,SGVsbG8=', () => {
  const { createDataUriPayload } = require(path.resolve(root, 'src/features/data-uri/payload.ts'));
  const artifact = createDataUriPayload(makeInput('data:text/plain;base64,SGVsbG8='));
  assert.ok(artifact, 'should detect data URI');

  const p = artifact;
  assert.equal(p.kind, 'data_uri_preview');
  assert.equal(p.mediaType, 'text/plain');
  assert.equal(p.isBase64, true);
  assert.equal(p.decodedSize, '5 B');
  assert.equal(p.decodedTextPreview, 'Hello');
});

test('fires on data:image/png;base64,iVBORw0KGgo=', () => {
  const { createDataUriPayload } = require(path.resolve(root, 'src/features/data-uri/payload.ts'));
  const artifact = createDataUriPayload(makeInput('data:image/png;base64,iVBORw0KGgo='));
  assert.ok(artifact, 'should detect image data URI');
  const p = artifact;
  assert.equal(p.isImage, true);
  assert.equal(p.decodedTextPreview, null);
});

test('fires on data:text/plain,Hello%20World', () => {
  const { createDataUriPayload } = require(path.resolve(root, 'src/features/data-uri/payload.ts'));
  const artifact = createDataUriPayload(makeInput('data:text/plain,Hello%20World'));
  assert.ok(artifact, 'should detect plain data URI');
  const p = artifact;
  assert.equal(p.isBase64, false);
  assert.equal(p.decodedTextPreview, 'Hello World');
});

test('fires on data:,Hello — empty mediatype defaults to text/plain;charset=US-ASCII', () => {
  const { createDataUriPayload } = require(path.resolve(root, 'src/features/data-uri/payload.ts'));
  const artifact = createDataUriPayload(makeInput('data:,Hello'));
  assert.ok(artifact, 'should detect data URI with no mediatype');
  const p = artifact;
  assert.equal(p.mediaType, 'text/plain;charset=US-ASCII');
  assert.equal(p.isDefault, true);
});

// ---------------------------------------------------------------------------
// Detector rejects non-data-URIs
// ---------------------------------------------------------------------------

test('rejects plain text "hello"', () => {
  const { createDataUriPayload } = require(path.resolve(root, 'src/features/data-uri/payload.ts'));
  assert.equal(createDataUriPayload(makeInput('hello')), null);
});

test('rejects bare base64 "SGVsbG8="', () => {
  const { createDataUriPayload } = require(path.resolve(root, 'src/features/data-uri/payload.ts'));
  assert.equal(createDataUriPayload(makeInput('SGVsbG8=')), null);
});

test('rejects URL "https://x.com"', () => {
  const { createDataUriPayload } = require(path.resolve(root, 'src/features/data-uri/payload.ts'));
  assert.equal(createDataUriPayload(makeInput('https://x.com')), null);
});

test('rejects "data:" with no comma', () => {
  const { createDataUriPayload } = require(path.resolve(root, 'src/features/data-uri/payload.ts'));
  assert.equal(createDataUriPayload(makeInput('data:')), null);
});

test('rejects empty string', () => {
  const { createDataUriPayload } = require(path.resolve(root, 'src/features/data-uri/payload.ts'));
  assert.equal(createDataUriPayload(makeInput('')), null);
});

test('rejects image content kind', () => {
  const { createDataUriPayload } = require(path.resolve(root, 'src/features/data-uri/payload.ts'));
  const artifact = createDataUriPayload({
    item: sampleItem,
    content: { kind: 'image', width: 100, height: 100, format: 'png', bytes: 0 },
    attachments: [],
  });
  assert.equal(artifact, null);
});

// ---------------------------------------------------------------------------
// decodeDataUriPayload
// ---------------------------------------------------------------------------

test('decodeDataUriPayload returns null for non-data_uri_preview payloads', () => {
  const { decodeDataUriPayload } = require(path.resolve(root, 'src/features/data-uri/payload.ts'));
  assert.equal(decodeDataUriPayload('not-json'), null);
  assert.equal(decodeDataUriPayload('{"kind":"other"}'), null);
  assert.equal(decodeDataUriPayload(null), null);
  assert.equal(decodeDataUriPayload(undefined), null);
});


test('decodeDataUriPayload accepts structured V2 attachment payloads', () => {
  const { createDataUriPayload, decodeDataUriPayload } = require(path.resolve(root, 'src/features/data-uri/payload.ts'));
  const payload = createDataUriPayload({ content: { kind: 'text', text: 'data:text/plain;base64,SGVsbG8=' } });
  assert.ok(payload);
  assert.deepEqual(decodeDataUriPayload(payload), payload);
  assert.deepEqual(decodeDataUriPayload(JSON.stringify(payload)), payload);
});
