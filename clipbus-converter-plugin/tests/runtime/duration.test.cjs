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

test('manifest has duration-detector', () => {
  const ids = manifest.detectors.map((d) => d.id);
  assert.ok(ids.includes('duration-detector'), 'missing duration-detector');
});

test('manifest has duration renderer', () => {
  const ids = manifest.renderers.map((r) => r.id);
  assert.ok(ids.includes('duration'), 'missing duration renderer');
});

test('duration renderer page references renderers/ path', () => {
  const renderer = manifest.renderers.find((r) => r.id === 'duration');
  assert.ok(renderer.page.startsWith('dist/ui/renderers/'), `unexpected page: ${renderer.page}`);
});

test('duration-detector attachmentTypes contains plugin.converter.duration', () => {
  const detector = manifest.detectors.find((d) => d.id === 'duration-detector');
  assert.ok(
    manifest.writes.attachmentTypes.includes('plugin.converter.duration'),
    'expected plugin.converter.duration in attachmentTypes'
  );
});



// ---------------------------------------------------------------------------
// Detector fires on valid ISO 8601 durations
// ---------------------------------------------------------------------------

test('createDurationPayload fires on PT4M13S', () => {
  const { createDurationPayload } = require(path.resolve(root, 'src/features/duration/payload.ts'));
  const artifact = createDurationPayload(makeInput('PT4M13S'));
  assert.ok(artifact, 'should detect PT4M13S');
});

test('createDurationPayload fires on P1Y2M10DT2H30M', () => {
  const { createDurationPayload } = require(path.resolve(root, 'src/features/duration/payload.ts'));
  const artifact = createDurationPayload(makeInput('P1Y2M10DT2H30M'));
  assert.ok(artifact, 'should detect P1Y2M10DT2H30M');
});

test('createDurationPayload fires on P3W', () => {
  const { createDurationPayload } = require(path.resolve(root, 'src/features/duration/payload.ts'));
  const artifact = createDurationPayload(makeInput('P3W'));
  assert.ok(artifact, 'should detect P3W');
});

test('createDurationPayload fires on PT1.5H', () => {
  const { createDurationPayload } = require(path.resolve(root, 'src/features/duration/payload.ts'));
  const artifact = createDurationPayload(makeInput('PT1.5H'));
  assert.ok(artifact, 'should detect PT1.5H');
});

test('createDurationPayload fires on P1DT12H', () => {
  const { createDurationPayload } = require(path.resolve(root, 'src/features/duration/payload.ts'));
  const artifact = createDurationPayload(makeInput('P1DT12H'));
  assert.ok(artifact, 'should detect P1DT12H');
});

test('createDurationPayload fires on PT0.5S', () => {
  const { createDurationPayload } = require(path.resolve(root, 'src/features/duration/payload.ts'));
  const artifact = createDurationPayload(makeInput('PT0.5S'));
  assert.ok(artifact, 'should detect PT0.5S');
});

// ---------------------------------------------------------------------------
// Detector rejects invalid inputs
// ---------------------------------------------------------------------------

test('createDurationPayload rejects bare "P"', () => {
  const { createDurationPayload } = require(path.resolve(root, 'src/features/duration/payload.ts'));
  assert.equal(createDurationPayload(makeInput('P')), null, '"P" must be rejected');
});

test('createDurationPayload rejects bare "PT"', () => {
  const { createDurationPayload } = require(path.resolve(root, 'src/features/duration/payload.ts'));
  assert.equal(createDurationPayload(makeInput('PT')), null, '"PT" must be rejected');
});

test('createDurationPayload rejects "PARIS"', () => {
  const { createDurationPayload } = require(path.resolve(root, 'src/features/duration/payload.ts'));
  assert.equal(createDurationPayload(makeInput('PARIS')), null, '"PARIS" must be rejected');
});

test('createDurationPayload rejects "hello"', () => {
  const { createDurationPayload } = require(path.resolve(root, 'src/features/duration/payload.ts'));
  assert.equal(createDurationPayload(makeInput('hello')), null, '"hello" must be rejected');
});

test('createDurationPayload rejects "P1Y2X"', () => {
  const { createDurationPayload } = require(path.resolve(root, 'src/features/duration/payload.ts'));
  assert.equal(createDurationPayload(makeInput('P1Y2X')), null, '"P1Y2X" must be rejected');
});

test('createDurationPayload rejects "1Y2M"', () => {
  const { createDurationPayload } = require(path.resolve(root, 'src/features/duration/payload.ts'));
  assert.equal(createDurationPayload(makeInput('1Y2M')), null, '"1Y2M" must be rejected');
});

test('createDurationPayload rejects "PT4M13S extra"', () => {
  const { createDurationPayload } = require(path.resolve(root, 'src/features/duration/payload.ts'));
  assert.equal(
    createDurationPayload(makeInput('PT4M13S extra')),
    null,
    '"PT4M13S extra" must be rejected'
  );
});

// ---------------------------------------------------------------------------
// Payload assertions
// ---------------------------------------------------------------------------

test('PT4M13S: totalSeconds === 253, approximate === false', () => {
  const { createDurationPayload } = require(path.resolve(root, 'src/features/duration/payload.ts'));
  const artifact = createDurationPayload(makeInput('PT4M13S'));
  const payload = artifact;
  assert.equal(payload.totalSeconds, 253);
  assert.equal(payload.approximate, false);
});

test('P1Y: approximate === true', () => {
  const { createDurationPayload } = require(path.resolve(root, 'src/features/duration/payload.ts'));
  const artifact = createDurationPayload(makeInput('P1Y'));
  const payload = artifact;
  assert.equal(payload.approximate, true);
});

test('P3W: totalSeconds === 1814400, approximate === false', () => {
  const { createDurationPayload } = require(path.resolve(root, 'src/features/duration/payload.ts'));
  const artifact = createDurationPayload(makeInput('P3W'));
  const payload = artifact;
  assert.equal(payload.totalSeconds, 1814400);
  assert.equal(payload.approximate, false);
});

test('P1Y2M10DT2H30M: humanBreakdown matches expected', () => {
  const { createDurationPayload } = require(path.resolve(root, 'src/features/duration/payload.ts'));
  const artifact = createDurationPayload(makeInput('P1Y2M10DT2H30M'));
  const payload = artifact;
  assert.equal(
    payload.humanBreakdown,
    '1 year, 2 months, 10 days, 2 hours, 30 minutes'
  );
});



test('decodeDurationPayload returns null for invalid inputs', () => {
  const { decodeDurationPayload } = require(path.resolve(root, 'src/features/duration/payload.ts'));
  assert.equal(decodeDurationPayload('not-json'), null);
  assert.equal(decodeDurationPayload('{"kind":"other"}'), null);
  assert.equal(decodeDurationPayload(null), null);
  assert.equal(decodeDurationPayload(undefined), null);
});

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
