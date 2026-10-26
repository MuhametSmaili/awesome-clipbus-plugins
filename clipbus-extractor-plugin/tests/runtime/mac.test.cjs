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

test('manifest has mac-detector', () => {
  const ids = manifest.detectors.map((d) => d.id);
  assert.ok(ids.includes('mac-detector'), 'missing mac-detector');
});

test('manifest has mac-address renderer', () => {
  const ids = manifest.renderers.map((r) => r.id);
  assert.ok(ids.includes('mac-address'), 'missing mac-address renderer');
});

test('mac-address page references dist/ui/renderers/ path', () => {
  const renderer = manifest.renderers.find((r) => r.id === 'mac-address');
  assert.ok(renderer.page.startsWith('dist/ui/renderers/'), `unexpected page: ${renderer.page}`);
});

test('manifest declares attachment type plugin.extractor.mac', () => {
  assert.ok(manifest.writes.attachmentTypes.includes('plugin.extractor.mac'));
});

test('mac-address renderer attachmentType is plugin.extractor.mac', () => {
  const r = manifest.renderers.find((r) => r.id === 'mac-address');
  assert.equal(r.attachmentType, 'plugin.extractor.mac');
});

// ---------------------------------------------------------------------------
// Factory methods
// ---------------------------------------------------------------------------

test('createMacDetector returns a detector function', () => {
  const { createMacDetector } = require(path.resolve(root, 'src/features/mac-address/detector.ts'));
  const handler = createMacDetector();
  assert.equal(typeof handler, 'function');
});


// ---------------------------------------------------------------------------
// Detector: fires on all accepted formats
// ---------------------------------------------------------------------------

test('detector fires on colon format "00:1A:2B:3C:4D:5E"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['mac-detector'];
  await det(makeInput('00:1A:2B:3C:4D:5E'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].type, 'plugin.extractor.mac');
});

test('detector fires on hyphen format "00-1a-2b-3c-4d-5e"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['mac-detector'];
  await det(makeInput('00-1a-2b-3c-4d-5e'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].type, 'plugin.extractor.mac');
});

test('detector fires on Cisco dot format "001A.2B3C.4D5E"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['mac-detector'];
  await det(makeInput('001A.2B3C.4D5E'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].type, 'plugin.extractor.mac');
});

test('detector fires on lowercase colon "ff:ee:dd:cc:bb:aa"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['mac-detector'];
  await det(makeInput('ff:ee:dd:cc:bb:aa'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 1);
});

// ---------------------------------------------------------------------------
// Detector: rejects invalid / ambiguous inputs
// ---------------------------------------------------------------------------

test('detector rejects bare 12-hex "001A2B3C4D5E"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['mac-detector'];
  await det(makeInput('001A2B3C4D5E'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects 5-group colon "00:1A:2B:3C:4D"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['mac-detector'];
  await det(makeInput('00:1A:2B:3C:4D'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects non-hex character "00:1A:2B:3C:4D:5G"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['mac-detector'];
  await det(makeInput('00:1A:2B:3C:4D:5G'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects plain text "hello"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['mac-detector'];
  await det(makeInput('hello'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects prose containing a MAC "mac 00:1a:2b:3c:4d:5e"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['mac-detector'];
  await det(makeInput('mac 00:1a:2b:3c:4d:5e'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects mixed separators "00:1A-2B:3C:4D:5E"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['mac-detector'];
  await det(makeInput('00:1A-2B:3C:4D:5E'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects empty string', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['mac-detector'];
  await det(makeInput(''), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects image content kind', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['mac-detector'];
  await det({
    item: itemSnapshot('image'),
    content: imageContent,
    trigger: 'copy',
  }, host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

// ---------------------------------------------------------------------------
// Payload: bit-flag assertions
// ---------------------------------------------------------------------------

test('createMacPayload: "01:00:5E:00:00:01" → cast Multicast', () => {
  const { createMacPayload } = require(path.resolve(root, 'src/features/mac-address/payload.ts'));
  const payload = createMacPayload(makeInput('01:00:5E:00:00:01'));
  assert.ok(payload, 'should produce payload');
  const p = payload;
  assert.equal(p.cast, 'Multicast (group)');
});

test('createMacPayload: "02:00:00:00:00:00" → administration Locally administered', () => {
  const { createMacPayload } = require(path.resolve(root, 'src/features/mac-address/payload.ts'));
  const payload = createMacPayload(makeInput('02:00:00:00:00:00'));
  assert.ok(payload, 'should produce payload');
  const p = payload;
  assert.equal(p.administration, 'Locally administered');
});

test('createMacPayload: "00:1A:2B:3C:4D:5E" → Unicast + Universal', () => {
  const { createMacPayload } = require(path.resolve(root, 'src/features/mac-address/payload.ts'));
  const payload = createMacPayload(makeInput('00:1A:2B:3C:4D:5E'));
  assert.ok(payload, 'should produce payload');
  const p = payload;
  assert.equal(p.cast, 'Unicast (individual)');
  assert.equal(p.administration, 'Universal (OUI/vendor-assigned)');
});

test('createMacPayload: "00:1A:2B:3C:4D:5E" → OUI "00:1A:2B"', () => {
  const { createMacPayload } = require(path.resolve(root, 'src/features/mac-address/payload.ts'));
  const payload = createMacPayload(makeInput('00:1A:2B:3C:4D:5E'));
  const p = payload;
  assert.equal(p.oui, '00:1A:2B');
});

test('createMacPayload: "FF:FF:FF:FF:FF:FF" → special Broadcast', () => {
  const { createMacPayload } = require(path.resolve(root, 'src/features/mac-address/payload.ts'));
  const payload = createMacPayload(makeInput('FF:FF:FF:FF:FF:FF'));
  assert.ok(payload, 'should produce payload');
  const p = payload;
  assert.equal(p.special, 'Broadcast');
});

// ---------------------------------------------------------------------------
// Payload: all normalized forms for "00:1A:2B:3C:4D:5E"
// ---------------------------------------------------------------------------

test('createMacPayload: normalized forms for "00:1A:2B:3C:4D:5E"', () => {
  const { createMacPayload } = require(path.resolve(root, 'src/features/mac-address/payload.ts'));
  const payload = createMacPayload(makeInput('00:1A:2B:3C:4D:5E'));
  assert.ok(payload);
  const p = payload;
  assert.equal(p.colonLower, '00:1a:2b:3c:4d:5e');
  assert.equal(p.colonUpper, '00:1A:2B:3C:4D:5E');
  assert.equal(p.hyphen,     '00-1A-2B-3C-4D-5E');
  assert.equal(p.ciscoDot,   '001A.2B3C.4D5E');
  assert.equal(p.bare,       '001a2b3c4d5e');
  assert.equal(p.nic,        '3C:4D:5E');
});

// ---------------------------------------------------------------------------
// Payload: Cisco dot input produces same octets
// ---------------------------------------------------------------------------

test('createMacPayload: Cisco dot "001A.2B3C.4D5E" → same forms as colon input', () => {
  const { createMacPayload } = require(path.resolve(root, 'src/features/mac-address/payload.ts'));
  const payload = createMacPayload(makeInput('001A.2B3C.4D5E'));
  assert.ok(payload);
  const p = payload;
  assert.equal(p.colonLower, '00:1a:2b:3c:4d:5e');
  assert.equal(p.colonUpper, '00:1A:2B:3C:4D:5E');
  assert.equal(p.ciscoDot,   '001A.2B3C.4D5E');
  assert.equal(p.bare,       '001a2b3c4d5e');
});

// ---------------------------------------------------------------------------
// Payload: ATTACHMENT_TYPE constant consistency
// ---------------------------------------------------------------------------

test('ATTACHMENT_TYPE constant equals plugin.extractor.mac', () => {
  const { ATTACHMENT_TYPE } = require(path.resolve(root, 'src/features/mac-address/payload.ts'));
  assert.equal(ATTACHMENT_TYPE, 'plugin.extractor.mac');
});

// ---------------------------------------------------------------------------
// Payload: decodeMacPayload
// ---------------------------------------------------------------------------

test('decodeMacPayload returns null for bad payloads', () => {
  const { decodeMacPayload } = require(path.resolve(root, 'src/features/mac-address/payload.ts'));
  assert.equal(decodeMacPayload('not-json'), null);
  assert.equal(decodeMacPayload('{"kind":"other"}'), null);
  assert.equal(decodeMacPayload(null), null);
  assert.equal(decodeMacPayload(undefined), null);
  const { createMacPayload } = require(path.resolve(root, 'src/features/mac-address/payload.ts'));
  const payload = createMacPayload({ content: { kind: 'text', text: '00:1A:2B:3C:4D:5E' } });
  assert.ok(payload);
  assert.deepEqual(decodeMacPayload(payload), payload);
  assert.deepEqual(decodeMacPayload(JSON.stringify(payload)), payload);
});

// ---------------------------------------------------------------------------
// Search projection
// ---------------------------------------------------------------------------

test('built MAC detector writes extractor search text and label', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  await registry.detectors['mac-detector'](makeInput('00:1A:2B:3C:4D:5E'), host.ctx);
  const [search] = host.paramsOf('item.setSearchExtension');
  assert.ok(search);
  assert.equal(search.scope, 'extractor');
  assert.equal(search.entries[0].label, 'MAC Address');
  assert.ok(search.entries[0].text.includes('00:1a:2b:3c:4d:5e'));
});
