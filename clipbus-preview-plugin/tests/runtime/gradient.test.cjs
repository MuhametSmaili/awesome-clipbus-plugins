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

test('manifest has gradient-detector', () => {
  const ids = manifest.detectors.map((d) => d.id);
  assert.ok(ids.includes('gradient-detector'), 'missing gradient-detector');
});

test('manifest has gradient-swatch renderer', () => {
  const ids = manifest.renderers.map((r) => r.id);
  assert.ok(ids.includes('gradient-swatch'), 'missing gradient-swatch');
});

test('gradient-swatch page references renderers/ path', () => {
  const renderer = manifest.renderers.find((r) => r.id === 'gradient-swatch');
  assert.ok(renderer.page.startsWith('dist/ui/renderers/'), `unexpected page: ${renderer.page}`);
});

test('gradient attachment type is declared for writes', () => {
  assert.ok(manifest.writes.attachmentTypes.includes('plugin.preview.gradient'));
});

test('gradient-swatch renderer attachmentType is plugin.preview.gradient', () => {
  const renderer = manifest.renderers.find((r) => r.id === 'gradient-swatch');
  assert.equal(renderer.attachmentType, 'plugin.preview.gradient');
});

// ---------------------------------------------------------------------------
// Feature factories
// ---------------------------------------------------------------------------

test('createGradientDetector returns a detector function', () => {
  const { createGradientDetector } = require(path.resolve(root, 'src/features/gradient-swatch/detector.ts'));
  const handler = createGradientDetector();
  assert.equal(typeof handler, 'function');
});


// ---------------------------------------------------------------------------
// Detector fires on valid gradients
// ---------------------------------------------------------------------------

test('createGradientPayload fires on linear-gradient', () => {
  const { createGradientPayload } = require(path.resolve(root, 'src/features/gradient-swatch/payload.ts'));
  const payload = createGradientPayload(makeInput('linear-gradient(to right, red, blue)'));
  assert.ok(payload, 'should detect linear-gradient');
  assert.equal(payload.gradientType, 'linear');
  assert.equal(payload.repeating, false);
  assert.ok(payload.stops.includes('red'), 'stops should include red');
  assert.ok(payload.stops.includes('blue'), 'stops should include blue');
  assert.equal(payload.angleOrShape, 'to right');
});

test('createGradientPayload fires on radial-gradient', () => {
  const { createGradientPayload } = require(path.resolve(root, 'src/features/gradient-swatch/payload.ts'));
  const payload = createGradientPayload(makeInput('radial-gradient(circle, #fff, #000)'));
  assert.ok(payload, 'should detect radial-gradient');
  assert.equal(payload.gradientType, 'radial');
  assert.ok(payload.stops.includes('#fff'), 'stops should include #fff');
  assert.ok(payload.stops.includes('#000'), 'stops should include #000');
  assert.equal(payload.angleOrShape, 'circle');
});

test('createGradientPayload fires on conic-gradient', () => {
  const { createGradientPayload } = require(path.resolve(root, 'src/features/gradient-swatch/payload.ts'));
  const payload = createGradientPayload(makeInput('conic-gradient(from 0deg, red, blue)'));
  assert.ok(payload, 'should detect conic-gradient');
  assert.equal(payload.gradientType, 'conic');
  assert.equal(payload.angleOrShape, 'from 0deg');
});

test('createGradientPayload fires on repeating-linear-gradient', () => {
  const { createGradientPayload } = require(path.resolve(root, 'src/features/gradient-swatch/payload.ts'));
  const payload = createGradientPayload(makeInput('repeating-linear-gradient(45deg, red 0 10px, blue 10px 20px)'));
  assert.ok(payload, 'should detect repeating-linear-gradient');
  assert.equal(payload.repeating, true);
  assert.equal(payload.gradientType, 'linear');
  assert.equal(payload.angleOrShape, '45deg');
  assert.ok(payload.stops.includes('red'), 'stops should include red');
  assert.ok(payload.stops.includes('blue'), 'stops should include blue');
});

// ---------------------------------------------------------------------------
// Detector rejects invalid / non-gradient inputs
// ---------------------------------------------------------------------------

test('createGradientPayload rejects plain text', () => {
  const { createGradientPayload } = require(path.resolve(root, 'src/features/gradient-swatch/payload.ts'));
  assert.equal(createGradientPayload(makeInput('hello')), null);
});

test('createGradientPayload rejects plain CSS named color', () => {
  const { createGradientPayload } = require(path.resolve(root, 'src/features/gradient-swatch/payload.ts'));
  assert.equal(createGradientPayload(makeInput('red')), null);
});

test('createGradientPayload rejects plain hex color', () => {
  const { createGradientPayload } = require(path.resolve(root, 'src/features/gradient-swatch/payload.ts'));
  assert.equal(createGradientPayload(makeInput('#ffffff')), null);
});

test('createGradientPayload rejects plain rgb() color', () => {
  const { createGradientPayload } = require(path.resolve(root, 'src/features/gradient-swatch/payload.ts'));
  assert.equal(createGradientPayload(makeInput('rgb(1,2,3)')), null);
});

test('createGradientPayload rejects CSS declaration with property prefix', () => {
  const { createGradientPayload } = require(path.resolve(root, 'src/features/gradient-swatch/payload.ts'));
  assert.equal(
    createGradientPayload(makeInput('background: linear-gradient(to right, red, blue)')),
    null
  );
});

test('createGradientPayload rejects unterminated gradient', () => {
  const { createGradientPayload } = require(path.resolve(root, 'src/features/gradient-swatch/payload.ts'));
  assert.equal(createGradientPayload(makeInput('linear-gradient(')), null);
});

// ---------------------------------------------------------------------------
// Color detector does NOT fire on gradients (no double-fire)
// ---------------------------------------------------------------------------

test('createColorPayload returns null for a gradient string', () => {
  const { createColorPayload } = require(path.resolve(root, 'src/features/color-swatch/payload.ts'));
  assert.equal(
    createColorPayload(makeInput('linear-gradient(to right, red, blue)')),
    null,
    'color-swatch should not fire on a gradient'
  );
});

// ---------------------------------------------------------------------------
// decodeGradientPayload
// ---------------------------------------------------------------------------

test('decodeGradientPayload returns null for bad payloads', () => {
  const { decodeGradientPayload } = require(path.resolve(root, 'src/features/gradient-swatch/payload.ts'));
  assert.equal(decodeGradientPayload('not-json'), null);
  assert.equal(decodeGradientPayload('{"kind":"other"}'), null);
  assert.equal(decodeGradientPayload(null), null);
  assert.equal(decodeGradientPayload(undefined), null);
});


test('decodeGradientPayload accepts the structured V2 payload and serialized samples', () => {
  const { createGradientPayload, decodeGradientPayload } = require(path.resolve(root, 'src/features/gradient-swatch/payload.ts'));
  const payload = createGradientPayload(makeInput('linear-gradient(to right, red, blue)'));
  assert.ok(payload);
  assert.equal(payload.kind, 'gradient_swatch');
  assert.deepEqual(decodeGradientPayload(payload), payload);
  assert.deepEqual(decodeGradientPayload(JSON.stringify(payload)), payload);
  assert.equal(decodeGradientPayload({ ...payload, version: 2 }), null);
});
