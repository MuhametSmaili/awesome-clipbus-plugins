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

test('manifest has uuid-detector', () => {
  const ids = manifest.detectors.map((d) => d.id);
  assert.ok(ids.includes('uuid-detector'), 'missing uuid-detector');
});

test('manifest has uuid-details renderer', () => {
  const ids = manifest.renderers.map((r) => r.id);
  assert.ok(ids.includes('uuid-details'), 'missing uuid-details renderer');
});

test('uuid-details page references dist/ui/renderers/ path', () => {
  const renderer = manifest.renderers.find((r) => r.id === 'uuid-details');
  assert.ok(renderer.page.startsWith('dist/ui/renderers/'), `unexpected page: ${renderer.page}`);
});

test('manifest declares attachment type plugin.extractor.uuid', () => {
  assert.ok(manifest.writes.attachmentTypes.includes('plugin.extractor.uuid'));
});

test('uuid-details renderer attachmentType is plugin.extractor.uuid', () => {
  const r = manifest.renderers.find((r) => r.id === 'uuid-details');
  assert.equal(r.attachmentType, 'plugin.extractor.uuid');
});

// ---------------------------------------------------------------------------
// Factory methods
// ---------------------------------------------------------------------------

test('createUuidDetector returns a detector function', () => {
  const { createUuidDetector } = require(path.resolve(root, 'src/features/uuid-details/detector.ts'));
  const handler = createUuidDetector();
  assert.equal(typeof handler, 'function');
});


// ---------------------------------------------------------------------------
// Detector: fires on valid UUIDs
// ---------------------------------------------------------------------------

test('detector fires on standard v4 UUID', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['uuid-detector'];
  await det(makeInput('550e8400-e29b-41d4-a716-446655440000'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].type, 'plugin.extractor.uuid');
});

test('detector fires on braced uppercase v1 UUID', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['uuid-detector'];
  // Braced + uppercase v1 UUID; should normalise to lowercase canonical
  await det(makeInput('{6BA7B810-9DAD-11D1-80B4-00C04FD430C8}'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].type, 'plugin.extractor.uuid');
  const p = attachments[0].entries[0].payload;
  assert.equal(p.canonical, '6ba7b810-9dad-11d1-80b4-00c04fd430c8');
});

test('detector fires on urn:uuid: prefixed UUID', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['uuid-detector'];
  await det(makeInput('urn:uuid:6ba7b810-9dad-11d1-80b4-00c04fd430c8'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 1);
  const p = attachments[0].entries[0].payload;
  assert.equal(p.canonical, '6ba7b810-9dad-11d1-80b4-00c04fd430c8');
});

test('detector fires on v7 UUID', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['uuid-detector'];
  await det(makeInput('01906a75-7d10-7ba8-8490-0000deadbeef'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 1);
  const p = attachments[0].entries[0].payload;
  assert.equal(p.uuidVersion, 7);
});

test('detector fires on Nil UUID', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['uuid-detector'];
  await det(makeInput('00000000-0000-0000-0000-000000000000'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 1);
  const p = attachments[0].entries[0].payload;
  assert.equal(p.special, 'Nil UUID');
});

test('detector fires on Max UUID', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['uuid-detector'];
  await det(makeInput('ffffffff-ffff-ffff-ffff-ffffffffffff'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 1);
  const p = attachments[0].entries[0].payload;
  assert.equal(p.special, 'Max UUID');
});

// ---------------------------------------------------------------------------
// Detector: rejects invalid inputs
// ---------------------------------------------------------------------------

test('detector rejects plain text "hello"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['uuid-detector'];
  await det(makeInput('hello'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects bare 32-hex without hyphens', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['uuid-detector'];
  await det(makeInput('550e8400e29b41d4a716446655440000'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects short UUID (missing last group)', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['uuid-detector'];
  await det(makeInput('550e8400-e29b-41d4-a716'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects prose containing a UUID', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['uuid-detector'];
  await det(makeInput('id is 550e8400-e29b-41d4-a716-446655440000 here'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects image content kind', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['uuid-detector'];
  await det({
    item: itemSnapshot('image'),
    content: imageContent,
    trigger: 'copy',
  }, host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

// ---------------------------------------------------------------------------
// Payload: v4 version and variant
// ---------------------------------------------------------------------------

test('createUuidPayload: v4 UUID → version 4 "Random (v4)", variant "RFC 4122/9562"', () => {
  const { createUuidPayload } = require(path.resolve(root, 'src/features/uuid-details/payload.ts'));
  const payload = createUuidPayload(makeInput('550e8400-e29b-41d4-a716-446655440000'));
  assert.ok(payload, 'should produce payload');
  const p = payload;
  assert.equal(p.uuidVersion, 4);
  assert.equal(p.versionLabel, 'Random (v4)');
  assert.equal(p.variant, 'RFC 4122/9562');
  assert.equal(p.timestamp, null);
  assert.equal(p.node, null);
  assert.equal(p.special, null);
});

// ---------------------------------------------------------------------------
// Payload: Nil UUID special label
// ---------------------------------------------------------------------------

test('createUuidPayload: Nil UUID → special "Nil UUID"', () => {
  const { createUuidPayload } = require(path.resolve(root, 'src/features/uuid-details/payload.ts'));
  const payload = createUuidPayload(makeInput('00000000-0000-0000-0000-000000000000'));
  assert.ok(payload);
  const p = payload;
  assert.equal(p.special, 'Nil UUID');
});

// ---------------------------------------------------------------------------
// Payload: v1 timestamp decoding
//
// UUID `13814000-1dd2-11b2-8000-000000000000` was constructed from the known
// Gregorian-to-Unix offset: ts = 0x01B21DD213814000 = 122192928000000000
// (100-ns intervals since 1582-10-15). Dividing by 10000 and subtracting the
// 12219292800000 ms offset gives exactly 0 ms → Unix epoch.
//
//   time_hi  = 0x11b2 & 0x0fff = 0x01b2 = 434
//   time_mid = 0x1dd2           = 7634
//   time_low = 0x13814000       = 327237632
//   ts = (434n << 48n) | (7634n << 32n) | 327237632n = 122192928000000000n
//   unixMs = 122192928000000000n / 10000n − 12219292800000n = 0n
//   ISO = "1970-01-01T00:00:00.000Z"
// ---------------------------------------------------------------------------

test('createUuidPayload: v1 UUID at Gregorian-offset epoch → timestamp "1970-01-01T00:00:00.000Z"', () => {
  const { createUuidPayload } = require(path.resolve(root, 'src/features/uuid-details/payload.ts'));
  const payload = createUuidPayload(makeInput('13814000-1dd2-11b2-8000-000000000000'));
  assert.ok(payload);
  const p = payload;
  assert.equal(p.uuidVersion, 1);
  assert.equal(p.timestamp, '1970-01-01T00:00:00.000Z');
});

test('createUuidPayload: v1 UUID has node field as MAC-style string', () => {
  const { createUuidPayload } = require(path.resolve(root, 'src/features/uuid-details/payload.ts'));
  // RFC 4122 DNS namespace UUID: node = 00:c0:4f:d4:30:c8
  const payload = createUuidPayload(makeInput('6ba7b810-9dad-11d1-80b4-00c04fd430c8'));
  assert.ok(payload);
  const p = payload;
  assert.equal(p.uuidVersion, 1);
  assert.equal(p.node, '00:c0:4f:d4:30:c8');
});

// ---------------------------------------------------------------------------
// Payload: v7 timestamp decoding
// The first 48 bits (group1 + group2 hex) are the Unix ms timestamp.
// ---------------------------------------------------------------------------

test('createUuidPayload: v7 UUID timestamp matches parseInt of first 12 hex digits', () => {
  const { createUuidPayload } = require(path.resolve(root, 'src/features/uuid-details/payload.ts'));
  const uuidStr = '01906a75-7d10-7ba8-8490-0000deadbeef';
  const payload = createUuidPayload(makeInput(uuidStr));
  assert.ok(payload);
  const p = payload;
  assert.equal(p.uuidVersion, 7);
  // Derive expected ISO from the first 12 hex digits (48-bit Unix ms)
  const expectedMs = parseInt('01906a75' + '7d10', 16);
  assert.equal(p.timestamp, new Date(expectedMs).toISOString());
});

// ---------------------------------------------------------------------------
// Payload: ATTACHMENT_TYPE constant consistency
// ---------------------------------------------------------------------------

test('ATTACHMENT_TYPE constant equals plugin.extractor.uuid', () => {
  const { ATTACHMENT_TYPE } = require(path.resolve(root, 'src/features/uuid-details/payload.ts'));
  assert.equal(ATTACHMENT_TYPE, 'plugin.extractor.uuid');
});

// ---------------------------------------------------------------------------
// Payload: decodeUuidPayload
// ---------------------------------------------------------------------------

test('decodeUuidPayload returns null for bad payloads', () => {
  const { decodeUuidPayload } = require(path.resolve(root, 'src/features/uuid-details/payload.ts'));
  assert.equal(decodeUuidPayload('not-json'), null);
  assert.equal(decodeUuidPayload('{"kind":"other"}'), null);
  assert.equal(decodeUuidPayload(null), null);
  assert.equal(decodeUuidPayload(undefined), null);
  const { createUuidPayload } = require(path.resolve(root, 'src/features/uuid-details/payload.ts'));
  const payload = createUuidPayload({ content: { kind: 'text', text: '550e8400-e29b-41d4-a716-446655440000' } });
  assert.ok(payload);
  assert.deepEqual(decodeUuidPayload(payload), payload);
  assert.deepEqual(decodeUuidPayload(JSON.stringify(payload)), payload);
});
