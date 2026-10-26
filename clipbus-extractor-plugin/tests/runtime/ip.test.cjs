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

test('manifest has ip-detector', () => {
  const ids = manifest.detectors.map((d) => d.id);
  assert.ok(ids.includes('ip-detector'), 'missing ip-detector');
});

test('manifest has ip-details renderer', () => {
  const ids = manifest.renderers.map((r) => r.id);
  assert.ok(ids.includes('ip-details'), 'missing ip-details renderer');
});

test('ip-details page references dist/ui/renderers/ path', () => {
  const renderer = manifest.renderers.find((r) => r.id === 'ip-details');
  assert.ok(renderer.page.startsWith('dist/ui/renderers/'), `unexpected page: ${renderer.page}`);
});

test('manifest declares attachment type plugin.extractor.ip', () => {
  assert.ok(manifest.writes.attachmentTypes.includes('plugin.extractor.ip'));
});

test('ip-details renderer attachmentType is plugin.extractor.ip', () => {
  const r = manifest.renderers.find((r) => r.id === 'ip-details');
  assert.equal(r.attachmentType, 'plugin.extractor.ip');
});

// ---------------------------------------------------------------------------
// Factory methods
// ---------------------------------------------------------------------------

test('createIpDetector returns a detector function', () => {
  const { createIpDetector } = require(path.resolve(root, 'src/features/ip-details/detector.ts'));
  const handler = createIpDetector();
  assert.equal(typeof handler, 'function');
});


// ---------------------------------------------------------------------------
// Detector: fires on valid single IPs
// ---------------------------------------------------------------------------

test('detector fires on plain IPv4', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['ip-detector'];
  await det(makeInput('192.168.1.10'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].type, 'plugin.extractor.ip');
});

test('detector fires on IPv4 CIDR', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['ip-detector'];
  await det(makeInput('10.0.0.0/8'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].type, 'plugin.extractor.ip');
});

test('detector fires on plain IPv6', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['ip-detector'];
  await det(makeInput('2001:db8::1'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].type, 'plugin.extractor.ip');
});

test('detector fires on IPv6 loopback ::1', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['ip-detector'];
  await det(makeInput('::1'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 1);
});

// ---------------------------------------------------------------------------
// Detector: rejects prose and invalid inputs
// ---------------------------------------------------------------------------

test('detector rejects prose containing an IP', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['ip-detector'];
  await det(makeInput('visit 1.2.3.4 now'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects invalid octet 999.1.1.1', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['ip-detector'];
  await det(makeInput('999.1.1.1'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects plain text "hello"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['ip-detector'];
  await det(makeInput('hello'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects malformed IPv6 with stray colons "2001:::1"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['ip-detector'];
  await det(makeInput('2001:::1'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects IPv6 with a trailing colon "2001::db8:"', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['ip-detector'];
  await det(makeInput('2001::db8:'), host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

test('detector rejects image content kind', async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const det = registry.detectors['ip-detector'];
  await det({
    item: itemSnapshot('image'),
    content: imageContent,
    trigger: 'copy',
  }, host.ctx);
  const attachments = host.paramsOf('item.setAttachments');
  assert.equal(attachments.length, 0);
});

// ---------------------------------------------------------------------------
// Payload: IPv4 CIDR assertions (192.168.1.0/24)
// ---------------------------------------------------------------------------

test('createIpPayload: 192.168.1.0/24 → correct network, broadcast, total, usable', () => {
  const { createIpPayload } = require(path.resolve(root, 'src/features/ip-details/payload.ts'));
  const payload = createIpPayload(makeInput('192.168.1.0/24'));
  assert.ok(payload, 'should produce payload');
  const p = payload;
  assert.equal(p.inputType, 'ipv4cidr');
  assert.equal(p.networkAddress, '192.168.1.0');
  assert.equal(p.broadcastAddress, '192.168.1.255');
  assert.equal(p.totalAddresses, 256);
  assert.equal(p.usableHostCount, 254);
});

// ---------------------------------------------------------------------------
// Payload: IPv4 scope
// ---------------------------------------------------------------------------

test('createIpPayload: 192.168.1.10 → scope Private', () => {
  const { createIpPayload } = require(path.resolve(root, 'src/features/ip-details/payload.ts'));
  const payload = createIpPayload(makeInput('192.168.1.10'));
  assert.ok(payload);
  const p = payload;
  assert.equal(p.scope, 'Private');
});

test('createIpPayload: 8.8.8.8 → scope Public', () => {
  const { createIpPayload } = require(path.resolve(root, 'src/features/ip-details/payload.ts'));
  const payload = createIpPayload(makeInput('8.8.8.8'));
  assert.ok(payload);
  const p = payload;
  assert.equal(p.scope, 'Public');
});

// ---------------------------------------------------------------------------
// Payload: IPv6 expansion
// ---------------------------------------------------------------------------

test('createIpPayload: 2001:db8::1 expands correctly', () => {
  const { createIpPayload } = require(path.resolve(root, 'src/features/ip-details/payload.ts'));
  const payload = createIpPayload(makeInput('2001:db8::1'));
  assert.ok(payload);
  const p = payload;
  assert.equal(p.expanded, '2001:0db8:0000:0000:0000:0000:0000:0001');
});

test('createIpPayload: ::1 scope is Loopback', () => {
  const { createIpPayload } = require(path.resolve(root, 'src/features/ip-details/payload.ts'));
  const payload = createIpPayload(makeInput('::1'));
  assert.ok(payload);
  const p = payload;
  assert.equal(p.scope, 'Loopback');
});

// ---------------------------------------------------------------------------
// Payload: ATTACHMENT_TYPE constant consistency
// ---------------------------------------------------------------------------

test('ATTACHMENT_TYPE constant equals plugin.extractor.ip', () => {
  const { ATTACHMENT_TYPE } = require(path.resolve(root, 'src/features/ip-details/payload.ts'));
  assert.equal(ATTACHMENT_TYPE, 'plugin.extractor.ip');
});

// ---------------------------------------------------------------------------
// Payload: decodeIpPayload
// ---------------------------------------------------------------------------

test('decodeIpPayload returns null for bad payloads', () => {
  const { decodeIpPayload } = require(path.resolve(root, 'src/features/ip-details/payload.ts'));
  assert.equal(decodeIpPayload('not-json'), null);
  assert.equal(decodeIpPayload('{"kind":"other"}'), null);
  assert.equal(decodeIpPayload(null), null);
  assert.equal(decodeIpPayload(undefined), null);
  const { createIpPayload } = require(path.resolve(root, 'src/features/ip-details/payload.ts'));
  const payload = createIpPayload({ content: { kind: 'text', text: '192.168.1.10' } });
  assert.ok(payload);
  assert.deepEqual(decodeIpPayload(payload), payload);
  assert.deepEqual(decodeIpPayload(JSON.stringify(payload)), payload);
});
