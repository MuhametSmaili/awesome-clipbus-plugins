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

test('manifest has color-detector', () => {
  const ids = manifest.detectors.map((d) => d.id);
  assert.ok(ids.includes('color-detector'), 'missing color-detector');
});

test('manifest has color-swatch renderer', () => {
  const ids = manifest.renderers.map((r) => r.id);
  assert.ok(ids.includes('color-swatch'), 'missing color-swatch');
});

test('color-swatch page references renderers/ path', () => {
  const renderer = manifest.renderers.find((r) => r.id === 'color-swatch');
  assert.ok(renderer.page.startsWith('dist/ui/renderers/'), `unexpected page: ${renderer.page}`);
});

// ---------------------------------------------------------------------------
// Feature factories — each returns a handler with the expected method
// ---------------------------------------------------------------------------

test('createColorDetector returns a detector function', () => {
  const { createColorDetector } = require(path.resolve(root, 'src/features/color-swatch/detector.ts'));
  const handler = createColorDetector();
  assert.equal(typeof handler, 'function');
});


// ---------------------------------------------------------------------------
// Detector / payload
// ---------------------------------------------------------------------------

test('createColorPayload detects hex color #3366ff', () => {
  const { createColorPayload } = require(path.resolve(root, 'src/features/color-swatch/payload.ts'));
  const payload = createColorPayload({
    item: sampleItem,
    content: { kind: 'text', text: '#3366ff' },
    attachments: [],
  });
  assert.ok(payload, 'payload should not be null for valid hex color');
  assert.equal(payload.kind, 'color_swatch');
  assert.equal(payload.hex, '#3366FF');
});

test('createColorPayload detects named color "red"', () => {
  const { createColorPayload } = require(path.resolve(root, 'src/features/color-swatch/payload.ts'));
  const payload = createColorPayload({
    item: sampleItem,
    content: { kind: 'text', text: 'red' },
    attachments: [],
  });
  assert.ok(payload, 'named color should be detected');
});

test('createColorPayload detects rgb() color', () => {
  const { createColorPayload } = require(path.resolve(root, 'src/features/color-swatch/payload.ts'));
  const payload = createColorPayload({
    item: sampleItem,
    content: { kind: 'text', text: 'rgb(100, 150, 200)' },
    attachments: [],
  });
  assert.ok(payload, 'rgb() color should be detected');
  assert.equal(payload.rgb.r, 100);
  assert.equal(payload.rgb.g, 150);
  assert.equal(payload.rgb.b, 200);
});

test('createColorPayload returns null for plain text', () => {
  const { createColorPayload } = require(path.resolve(root, 'src/features/color-swatch/payload.ts'));
  const payload = createColorPayload({
    item: sampleItem,
    content: { kind: 'text', text: 'hello world' },
    attachments: [],
  });
  assert.equal(payload, null, 'plain text should not be detected as a color');
});

test('createColorPayload returns null for image content kind', () => {
  const { createColorPayload } = require(path.resolve(root, 'src/features/color-swatch/payload.ts'));
  const payload = createColorPayload({
    item: sampleItem,
    content: { kind: 'image', width: 100, height: 100, format: 'png', bytes: 0 },
    attachments: [],
  });
  assert.equal(payload, null, 'image kind should not produce color payload');
});

test('decodeColorPayload returns null for bad payloads', () => {
  const { decodeColorPayload } = require(path.resolve(root, 'src/features/color-swatch/payload.ts'));
  assert.equal(decodeColorPayload('not-json'), null);
  assert.equal(decodeColorPayload('{"kind":"other"}'), null);
  assert.equal(decodeColorPayload(null), null);
  assert.equal(decodeColorPayload(undefined), null);
});


test('decodeColorPayload accepts the structured V2 payload and serialized samples', () => {
  const { createColorPayload, decodeColorPayload } = require(path.resolve(root, 'src/features/color-swatch/payload.ts'));
  const payload = createColorPayload({ content: { kind: 'text', text: '#3366ff' } });
  assert.ok(payload);
  assert.equal(payload.kind, 'color_swatch');
  assert.deepEqual(decodeColorPayload(payload), payload);
  assert.deepEqual(decodeColorPayload(JSON.stringify(payload)), payload);
  assert.equal(decodeColorPayload({ ...payload, version: 2 }), null);
});
