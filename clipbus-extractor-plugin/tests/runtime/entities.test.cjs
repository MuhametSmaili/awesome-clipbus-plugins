'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.resolve(root, 'manifest.json'), 'utf8'));

const { itemSnapshot } = require('../support/plugin.cjs');
const sampleItem = itemSnapshot('text');

// ---------------------------------------------------------------------------
// Manifest shape
// ---------------------------------------------------------------------------

test('manifest has entities-detector', () => {
  const ids = manifest.detectors.map((d) => d.id);
  assert.ok(ids.includes('entities-detector'), 'missing entities-detector');
});

test('manifest has entities-renderer', () => {
  const ids = manifest.renderers.map((r) => r.id);
  assert.ok(ids.includes('entities-renderer'), 'missing entities-renderer');
});

test('entities-renderer page references dist/ui/renderers/ path', () => {
  const renderer = manifest.renderers.find((r) => r.id === 'entities-renderer');
  assert.ok(renderer.page.startsWith('dist/ui/renderers/'), `unexpected page: ${renderer.page}`);
});

// ---------------------------------------------------------------------------
// Detector / payload
// ---------------------------------------------------------------------------

test('detector extracts urls, email, and ip from mixed text', async () => {
  const { createEntitiesPayload, ATTACHMENT_TYPE } = require(path.resolve(root, 'src/features/entities-renderer/payload.ts'));
  const text = 'Contact me at john@example.com or visit https://example.com and https://foo.org, server 192.168.1.1';
  const input = { item: sampleItem, content: { kind: 'text', text }, trigger: 'copy' };
  const payload = createEntitiesPayload(input);
  assert.ok(payload, 'payload should not be null for mixed input');
  assert.equal(ATTACHMENT_TYPE, 'plugin.extractor.entities');
  assert.ok(payload.urls.includes('https://example.com'), 'should include https://example.com');
  assert.ok(payload.urls.includes('https://foo.org'), 'should include https://foo.org');
  assert.ok(payload.emails.includes('john@example.com'), 'should include john@example.com');
  assert.ok(payload.ips.includes('192.168.1.1'), 'should include 192.168.1.1');
  assert.equal(payload.totalCount, 4, 'totalCount should be 4');
});

test('detector returns null for plain text', () => {
  const { createEntitiesPayload } = require(path.resolve(root, 'src/features/entities-renderer/payload.ts'));
  const payload = createEntitiesPayload({ item: sampleItem, content: { kind: 'text', text: 'just some plain text without links' }, trigger: 'copy' });
  assert.equal(payload, null, 'plain text should return null');
});

test('detector returns null when only one entity found', () => {
  const { createEntitiesPayload } = require(path.resolve(root, 'src/features/entities-renderer/payload.ts'));
  const payload = createEntitiesPayload({ item: sampleItem, content: { kind: 'text', text: 'https://only-one.com' }, trigger: 'copy' });
  assert.equal(payload, null, 'single entity (total < 2) should return null');
});

test('detector deduplicates repeated URLs', () => {
  const { createEntitiesPayload } = require(path.resolve(root, 'src/features/entities-renderer/payload.ts'));
  const text = 'See https://example.com and also https://example.com again, also https://other.com';
  const payload = createEntitiesPayload({ item: sampleItem, content: { kind: 'text', text }, trigger: 'copy' });
  assert.ok(payload, 'payload should not be null');
  const count = payload.urls.filter((u) => u === 'https://example.com').length;
  assert.equal(count, 1, 'duplicate URL should appear only once');
});

test('detector strips trailing punctuation from URLs', () => {
  const { createEntitiesPayload } = require(path.resolve(root, 'src/features/entities-renderer/payload.ts'));
  const text = 'Visit https://example.com, and https://foo.org.';
  const payload = createEntitiesPayload({ item: sampleItem, content: { kind: 'text', text }, trigger: 'copy' });
  assert.ok(payload, 'payload should not be null');
  assert.ok(payload.urls.includes('https://example.com'), 'trailing comma stripped');
  assert.ok(payload.urls.includes('https://foo.org'), 'trailing period stripped');
});

test('decodeEntitiesPayload returns null for bad data', () => {
  const { decodeEntitiesPayload } = require(path.resolve(root, 'src/features/entities-renderer/payload.ts'));
  assert.equal(decodeEntitiesPayload('not-json'), null);
  assert.equal(decodeEntitiesPayload('{"kind":"other"}'), null);
  assert.equal(decodeEntitiesPayload(null), null);
  assert.equal(decodeEntitiesPayload(undefined), null);
  const { createEntitiesPayload } = require(path.resolve(root, 'src/features/entities-renderer/payload.ts'));
  const payload = createEntitiesPayload({ content: { kind: 'text', text: 'https://example.com john@example.com' } });
  assert.ok(payload);
  assert.deepEqual(decodeEntitiesPayload(payload), payload);
  assert.deepEqual(decodeEntitiesPayload(JSON.stringify(payload)), payload);
});
