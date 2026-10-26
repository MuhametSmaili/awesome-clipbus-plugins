'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.resolve(root, 'manifest.json'), 'utf8'));

const sampleItem = {
  id: 'item-1',
  type: 'text',
  tags: [],
  sourceAppID: 'com.example.app',
};

function makeInput(text) {
  return { item: sampleItem, content: { kind: 'text', text }, attachments: [] };
}

// ---------------------------------------------------------------------------
// Manifest shape
// ---------------------------------------------------------------------------

test('manifest has temperature-detector', () => {
  const ids = manifest.detectors.map((d) => d.id);
  assert.ok(ids.includes('temperature-detector'), 'missing temperature-detector');
});

test('manifest has temperature renderer', () => {
  const ids = manifest.renderers.map((r) => r.id);
  assert.ok(ids.includes('temperature'), 'missing temperature renderer');
});

test('temperature renderer page references renderers/ path', () => {
  const renderer = manifest.renderers.find((r) => r.id === 'temperature');
  assert.ok(renderer.page.startsWith('dist/ui/renderers/'), `unexpected page: ${renderer.page}`);
});

test('temperature-detector attachmentTypes contains plugin.converter.temperature', () => {
  const detector = manifest.detectors.find((d) => d.id === 'temperature-detector');
  assert.ok(
    manifest.writes.attachmentTypes.includes('plugin.converter.temperature'),
    'expected plugin.converter.temperature in attachmentTypes'
  );
});



// ---------------------------------------------------------------------------
// Detector fires on valid temperature inputs
// ---------------------------------------------------------------------------

test('createTemperaturePayload fires on "37°C"', () => {
  const { createTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  const artifact = createTemperaturePayload(makeInput('37°C'));
  assert.ok(artifact, 'should detect "37°C"');
});

test('createTemperaturePayload fires on "98.6°F"', () => {
  const { createTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  const artifact = createTemperaturePayload(makeInput('98.6°F'));
  assert.ok(artifact, 'should detect "98.6°F"');
});

test('createTemperaturePayload fires on "300 K"', () => {
  const { createTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  const artifact = createTemperaturePayload(makeInput('300 K'));
  assert.ok(artifact, 'should detect "300 K"');
});

test('createTemperaturePayload fires on "37 Celsius"', () => {
  const { createTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  const artifact = createTemperaturePayload(makeInput('37 Celsius'));
  assert.ok(artifact, 'should detect "37 Celsius"');
});

test('createTemperaturePayload fires on "-40°C"', () => {
  const { createTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  const artifact = createTemperaturePayload(makeInput('-40°C'));
  assert.ok(artifact, 'should detect "-40°C"');
});

test('createTemperaturePayload fires on "0℃"', () => {
  const { createTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  const artifact = createTemperaturePayload(makeInput('0℃'));
  assert.ok(artifact, 'should detect "0℃"');
});

test('createTemperaturePayload fires on "212 °F"', () => {
  const { createTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  const artifact = createTemperaturePayload(makeInput('212 °F'));
  assert.ok(artifact, 'should detect "212 °F"');
});

// ---------------------------------------------------------------------------
// Detector rejects invalid inputs (false-positive guard)
// ---------------------------------------------------------------------------

test('createTemperaturePayload rejects "300K" (bare K, no space/degree)', () => {
  const { createTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  assert.equal(createTemperaturePayload(makeInput('300K')), null, '"300K" must be rejected');
});

test('createTemperaturePayload rejects "37C" (bare C, no space/degree)', () => {
  const { createTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  assert.equal(createTemperaturePayload(makeInput('37C')), null, '"37C" must be rejected');
});

test('createTemperaturePayload rejects "hello"', () => {
  const { createTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  assert.equal(createTemperaturePayload(makeInput('hello')), null, '"hello" must be rejected');
});

test('createTemperaturePayload rejects "37" (no unit)', () => {
  const { createTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  assert.equal(createTemperaturePayload(makeInput('37')), null, '"37" must be rejected');
});

test('createTemperaturePayload rejects "37°" (degree but no scale letter)', () => {
  const { createTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  assert.equal(createTemperaturePayload(makeInput('37°')), null, '"37°" must be rejected');
});

test('createTemperaturePayload rejects "100°X" (unknown unit)', () => {
  const { createTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  assert.equal(createTemperaturePayload(makeInput('100°X')), null, '"100°X" must be rejected');
});

test('createTemperaturePayload rejects "" (empty)', () => {
  const { createTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  assert.equal(createTemperaturePayload(makeInput('')), null, '"" must be rejected');
});

// ---------------------------------------------------------------------------
// Payload assertions
// ---------------------------------------------------------------------------

test('"37°C" → fahrenheit 98.6, kelvin 310.15', () => {
  const { createTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  const artifact = createTemperaturePayload(makeInput('37°C'));
  const payload = artifact;
  assert.equal(payload.fahrenheit, 98.6);
  assert.equal(payload.kelvin, 310.15);
});

test('"100°C" → fahrenheit 212, kelvin 373.15', () => {
  const { createTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  const artifact = createTemperaturePayload(makeInput('100°C'));
  const payload = artifact;
  assert.equal(payload.fahrenheit, 212);
  assert.equal(payload.kelvin, 373.15);
});

test('"-40°C" → fahrenheit -40', () => {
  const { createTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  const artifact = createTemperaturePayload(makeInput('-40°C'));
  const payload = artifact;
  assert.equal(payload.fahrenheit, -40);
});

test('"300 K" → sourceScale "K", celsius 26.85', () => {
  const { createTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  const artifact = createTemperaturePayload(makeInput('300 K'));
  const payload = artifact;
  assert.equal(payload.sourceScale, 'K');
  assert.equal(payload.celsius, 26.85);
});

test('"-300°C" → belowAbsoluteZero true', () => {
  const { createTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  const artifact = createTemperaturePayload(makeInput('-300°C'));
  const payload = artifact;
  assert.equal(payload.belowAbsoluteZero, true);
});



test('decodeTemperaturePayload returns null for invalid inputs', () => {
  const { decodeTemperaturePayload } = require(path.resolve(root, 'src/features/temperature/payload.ts'));
  assert.equal(decodeTemperaturePayload('not-json'), null);
  assert.equal(decodeTemperaturePayload('{"kind":"other"}'), null);
  assert.equal(decodeTemperaturePayload(null), null);
  assert.equal(decodeTemperaturePayload(undefined), null);
});

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
