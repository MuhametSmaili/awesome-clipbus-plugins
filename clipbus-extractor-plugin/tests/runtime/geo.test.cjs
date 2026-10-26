'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.resolve(root, 'manifest.json'), 'utf8'));

const { fakeHost, itemSnapshot, setupPlugin, imageContent } = require('../support/plugin.cjs');
const sampleItem = itemSnapshot('text');

function makeInput(text) {
  return { item: sampleItem, content: { kind: 'text', text }, trigger: 'copy' };
}

// ---------------------------------------------------------------------------
// Manifest shape
// ---------------------------------------------------------------------------

test('manifest has geo-detector', () => {
  const ids = manifest.detectors.map((d) => d.id);
  assert.ok(ids.includes('geo-detector'), 'missing geo-detector');
});

test('manifest has geo-coordinates renderer', () => {
  const ids = manifest.renderers.map((r) => r.id);
  assert.ok(ids.includes('geo-coordinates'), 'missing geo-coordinates renderer');
});

test('geo-coordinates page references dist/ui/renderers/ path', () => {
  const renderer = manifest.renderers.find((r) => r.id === 'geo-coordinates');
  assert.ok(renderer.page.startsWith('dist/ui/renderers/'), `unexpected page: ${renderer.page}`);
});

test('manifest declares attachment type plugin.extractor.geo', () => {
  assert.ok(manifest.writes.attachmentTypes.includes('plugin.extractor.geo'));
});

test('geo-coordinates renderer attachmentType is plugin.extractor.geo', () => {
  const r = manifest.renderers.find((r) => r.id === 'geo-coordinates');
  assert.equal(r.attachmentType, 'plugin.extractor.geo');
});

test('toDms carries 60" up to the next minute/degree (no invalid 60.0 component)', () => {
  const { createGeoPayload } = require(path.resolve(root, 'src/features/geo-coordinates/payload.ts'));
  const payload = createGeoPayload(makeInput('10.999999, 20.0'));
  assert.ok(payload, 'should produce payload');
  const p = payload;
  assert.ok(!p.latDms.includes('60.0'), `latDms must not contain a 60.0 second: ${p.latDms}`);
  assert.equal(p.latDms, `11°0'0.0"N`);
});

// ---------------------------------------------------------------------------
// Factory methods
// ---------------------------------------------------------------------------

test('createGeoDetector returns a detector function', () => {
  const { createGeoDetector } = require(path.resolve(root, 'src/features/geo-coordinates/detector.ts'));
  const handler = createGeoDetector();
  assert.equal(typeof handler, 'function');
});


// ---------------------------------------------------------------------------
// Detector: fires on valid coordinate pairs
// ---------------------------------------------------------------------------

test('detector fires on "37.7749, -122.4194"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['geo-detector'];
  await det(makeInput('37.7749, -122.4194'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].type, 'plugin.extractor.geo');
});

test('detector fires on "40.7128° N, 74.0060° W"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['geo-detector'];
  await det(makeInput('40.7128° N, 74.0060° W'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].type, 'plugin.extractor.geo');
});

// ---------------------------------------------------------------------------
// Detector: rejects invalid / prose inputs
// ---------------------------------------------------------------------------

test('detector rejects "hello"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['geo-detector'];
  await det(makeInput('hello'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects bare integer pair "1, 2"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['geo-detector'];
  await det(makeInput('1, 2'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects out-of-range "200, 300"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['geo-detector'];
  await det(makeInput('200, 300'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects out-of-range "-91, 0"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['geo-detector'];
  await det(makeInput('-91, 0'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects 3-number CSV "1.0,2.0,3.0"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['geo-detector'];
  await det(makeInput('1.0,2.0,3.0'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects prose "meet at 37.7, -122.4 ok"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['geo-detector'];
  await det(makeInput('meet at 37.7, -122.4 ok'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

// ---------------------------------------------------------------------------
// Payload: DMS conversion
// ---------------------------------------------------------------------------

test('latitude DMS for 37.7749 is "37°46\'29.6\\"N"', () => {
  const { createGeoPayload } = require(path.resolve(root, 'src/features/geo-coordinates/payload.ts'));
  const payload = createGeoPayload(makeInput('37.7749, -122.4194'));
  assert.ok(payload, 'should produce payload');
  const p = payload;
  assert.equal(p.latDms, "37°46'29.6\"N");
});

// ---------------------------------------------------------------------------
// Payload: hemisphere folding
// ---------------------------------------------------------------------------

test('hemisphere folding: "10.0 S, 20.0 W" gives negative lat & lng', () => {
  const { createGeoPayload } = require(path.resolve(root, 'src/features/geo-coordinates/payload.ts'));
  const payload = createGeoPayload(makeInput('10.0 S, 20.0 W'));
  assert.ok(payload, 'should produce payload');
  const p = payload;
  assert.ok(p.lat < 0, `lat should be negative, got ${p.lat}`);
  assert.ok(p.lng < 0, `lng should be negative, got ${p.lng}`);
});

// ---------------------------------------------------------------------------
// Payload: maps URLs
// ---------------------------------------------------------------------------

test('OSM URL contains decimal lat and lng', () => {
  const { createGeoPayload } = require(path.resolve(root, 'src/features/geo-coordinates/payload.ts'));
  const payload = createGeoPayload(makeInput('37.7749, -122.4194'));
  assert.ok(payload);
  const p = payload;
  assert.ok(p.osmUrl.includes('37.7749'), `osmUrl should contain lat: ${p.osmUrl}`);
  assert.ok(p.osmUrl.includes('-122.4194'), `osmUrl should contain lng: ${p.osmUrl}`);
});

test('Google URL contains decimal lat and lng', () => {
  const { createGeoPayload } = require(path.resolve(root, 'src/features/geo-coordinates/payload.ts'));
  const payload = createGeoPayload(makeInput('37.7749, -122.4194'));
  assert.ok(payload);
  const p = payload;
  assert.ok(p.googleUrl.includes('37.7749'), `googleUrl should contain lat: ${p.googleUrl}`);
  assert.ok(p.googleUrl.includes('-122.4194'), `googleUrl should contain lng: ${p.googleUrl}`);
});

// ---------------------------------------------------------------------------
// Payload: ATTACHMENT_TYPE constant consistency
// ---------------------------------------------------------------------------

test('ATTACHMENT_TYPE constant equals plugin.extractor.geo', () => {
  const { ATTACHMENT_TYPE } = require(path.resolve(root, 'src/features/geo-coordinates/payload.ts'));
  assert.equal(ATTACHMENT_TYPE, 'plugin.extractor.geo');
});

// ---------------------------------------------------------------------------
// Payload: decodeGeoPayload
// ---------------------------------------------------------------------------

test('decodeGeoPayload returns null for bad payloads', () => {
  const { decodeGeoPayload } = require(path.resolve(root, 'src/features/geo-coordinates/payload.ts'));
  assert.equal(decodeGeoPayload('not-json'), null);
  assert.equal(decodeGeoPayload('{"kind":"other"}'), null);
  assert.equal(decodeGeoPayload(null), null);
  assert.equal(decodeGeoPayload(undefined), null);
  const { createGeoPayload } = require(path.resolve(root, 'src/features/geo-coordinates/payload.ts'));
  const payload = createGeoPayload({ content: { kind: 'text', text: '37.7749, -122.4194' } });
  assert.ok(payload);
  assert.deepEqual(decodeGeoPayload(payload), payload);
  assert.deepEqual(decodeGeoPayload(JSON.stringify(payload)), payload);
});
