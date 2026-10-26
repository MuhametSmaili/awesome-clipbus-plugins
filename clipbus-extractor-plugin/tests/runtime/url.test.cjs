'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.resolve(root, 'manifest.json'), 'utf8'));

const { itemSnapshot } = require('../support/plugin.cjs');
const sampleItem = itemSnapshot('text');

const sampleUrl = 'https://example.com:8080/a/b?x=1&y=2#frag';

// ---------------------------------------------------------------------------
// Manifest shape
// ---------------------------------------------------------------------------

test('manifest has url-detector', () => {
  const ids = manifest.detectors.map((d) => d.id);
  assert.ok(ids.includes('url-detector'), 'missing url-detector');
});

test('manifest has url-parsed renderer', () => {
  const ids = manifest.renderers.map((r) => r.id);
  assert.ok(ids.includes('url-parsed'), 'missing url-parsed');
});

test('url-parsed page references dist/ui/renderers/ path', () => {
  const renderer = manifest.renderers.find((r) => r.id === 'url-parsed');
  assert.ok(renderer.page.startsWith('dist/ui/renderers/'), `unexpected page: ${renderer.page}`);
});

// ---------------------------------------------------------------------------
// Feature factories — each returns a handler with the expected method
// ---------------------------------------------------------------------------

test('createUrlDetector returns a detector function', () => {
  const { createUrlDetector } = require(path.resolve(root, 'src/features/url-parsed/detector.ts'));
  const handler = createUrlDetector();
  assert.equal(typeof handler, 'function');
});


// ---------------------------------------------------------------------------
// Detector / payload
// ---------------------------------------------------------------------------

test('createUrlPayload parses full URL with host, port, query, hash', () => {
  const { createUrlPayload, ATTACHMENT_TYPE } = require(path.resolve(root, 'src/features/url-parsed/payload.ts'));
  const payload = createUrlPayload({
    item: sampleItem,
    content: { kind: 'text', text: sampleUrl },
    trigger: 'copy',
  });
  assert.ok(payload, 'payload should not be null for valid URL');
  assert.equal(ATTACHMENT_TYPE, 'plugin.extractor.url');
  assert.equal(payload.kind, 'url_parsed');
  assert.equal(payload.inputType, 'url');
  assert.equal(payload.host, 'example.com');
  assert.equal(payload.port, '8080');
  assert.equal(payload.query.length, 2);
  assert.equal(payload.query[0].key, 'x');
  assert.equal(payload.query[0].value, '1');
  assert.equal(payload.query[1].key, 'y');
  assert.equal(payload.query[1].value, '2');
});

test('createUrlPayload returns null for plain text', () => {
  const { createUrlPayload } = require(path.resolve(root, 'src/features/url-parsed/payload.ts'));
  const payload = createUrlPayload({
    item: sampleItem,
    content: { kind: 'text', text: 'hello world' },
    trigger: 'copy',
  });
  assert.equal(payload, null, 'plain text should not produce payload');
});

test('createUrlPayload returns null for mailto: (no // authority)', () => {
  const { createUrlPayload } = require(path.resolve(root, 'src/features/url-parsed/payload.ts'));
  const payload = createUrlPayload({
    item: sampleItem,
    content: { kind: 'text', text: 'mailto:a@b.com' },
    trigger: 'copy',
  });
  assert.equal(payload, null, 'mailto: should not produce payload');
});

test('createUrlPayload detects plain https URL', () => {
  const { createUrlPayload } = require(path.resolve(root, 'src/features/url-parsed/payload.ts'));
  const payload = createUrlPayload({
    item: sampleItem,
    content: { kind: 'text', text: 'https://example.com/p?a=1' },
    trigger: 'copy',
  });
  assert.ok(payload, 'https URL should be detected');
  assert.equal(payload.scheme, 'https');
  assert.equal(payload.query.length, 1);
});

test('createUrlPayload parses query values with URLSearchParams semantics', () => {
  const { createUrlPayload } = require(path.resolve(root, 'src/features/url-parsed/payload.ts'));
  const payload = createUrlPayload({
    item: sampleItem,
    content: {
      kind: 'text',
      text: 'https://example.com/?bad=%FF&nul=%00&ok=%E4%BD%A0%E5%A5%BD&space=hello+world',
    },
    trigger: 'copy',
  });
  assert.ok(payload, 'the URL itself remains valid');
  assert.deepEqual(payload.query, [
    { key: 'bad', value: '�' },
    { key: 'nul', value: '\u0000' },
    { key: 'ok', value: '你好' },
    { key: 'space', value: 'hello world' },
  ]);
});

test('createUrlPayload detects naked query strings and preserves duplicate pairs', () => {
  const { createUrlPayload } = require(path.resolve(root, 'src/features/url-parsed/payload.ts'));
  const payload = createUrlPayload({
    item: sampleItem,
    content: { kind: 'text', text: 'tag=one&tag=two&lang=zh-CN' },
    trigger: 'copy',
  });
  assert.ok(payload);
  assert.equal(payload.inputType, 'query');
  assert.deepEqual(payload.query, [
    { key: 'tag', value: 'one' },
    { key: 'tag', value: 'two' },
    { key: 'lang', value: 'zh-CN' },
  ]);
  assert.equal(payload.hasDuplicateKeys, true);
  assert.deepEqual(JSON.parse(payload.queryJson), { tag: 'two', lang: 'zh-CN' });
});

test('createUrlPayload rejects ambiguous single-pair text', () => {
  const { createUrlPayload } = require(path.resolve(root, 'src/features/url-parsed/payload.ts'));
  assert.equal(createUrlPayload({
    item: sampleItem,
    content: { kind: 'text', text: 'status=ready' },
    trigger: 'copy',
  }), null);
});

test('decodeUrlPayload returns null for bad payloads', () => {
  const { decodeUrlPayload } = require(path.resolve(root, 'src/features/url-parsed/payload.ts'));
  assert.equal(decodeUrlPayload('not-json'), null);
  assert.equal(decodeUrlPayload('{"kind":"other"}'), null);
  assert.equal(decodeUrlPayload(null), null);
  assert.equal(decodeUrlPayload(undefined), null);
  const { createUrlPayload } = require(path.resolve(root, 'src/features/url-parsed/payload.ts'));
  const payload = createUrlPayload({ content: { kind: 'text', text: 'tag=one&tag=two' } });
  assert.ok(payload);
  assert.deepEqual(decodeUrlPayload(payload), payload);
  assert.deepEqual(decodeUrlPayload(JSON.stringify(payload)), payload);
});

// ---------------------------------------------------------------------------
// Tracking param detection
// ---------------------------------------------------------------------------

test('createUrlPayload strips utm_* and fbclid from cleanHref, keeps legit params', () => {
  const { createUrlPayload } = require(path.resolve(root, 'src/features/url-parsed/payload.ts'));
  const payload = createUrlPayload({
    item: sampleItem,
    content: {
      kind: 'text',
      text: 'https://example.com/article?utm_source=newsletter&utm_medium=email&fbclid=AbC123&id=42',
    },
    trigger: 'copy',
  });
  assert.ok(payload, 'payload should not be null');
  // trackingParams lists only the trackers
  assert.equal(payload.trackingParams.length, 3);
  const trackerKeys = payload.trackingParams.map((p) => p.key);
  assert.ok(trackerKeys.includes('utm_source'), 'utm_source should be tracked');
  assert.ok(trackerKeys.includes('utm_medium'), 'utm_medium should be tracked');
  assert.ok(trackerKeys.includes('fbclid'), 'fbclid should be tracked');
  // cleanHref keeps the legit param and path, strips the trackers
  const clean = new URL(payload.cleanHref);
  assert.equal(clean.searchParams.get('id'), '42', 'legit param id=42 must survive');
  assert.equal(clean.searchParams.get('utm_source'), null, 'utm_source must be removed');
  assert.equal(clean.searchParams.get('fbclid'), null, 'fbclid must be removed');
  assert.equal(clean.pathname, '/article', 'path must be preserved');
  // query array still has all four params (unchanged)
  assert.equal(payload.query.length, 4);
});

test('createUrlPayload with no tracking params: trackingParams empty, cleanHref === href', () => {
  const { createUrlPayload } = require(path.resolve(root, 'src/features/url-parsed/payload.ts'));
  const payload = createUrlPayload({
    item: sampleItem,
    content: {
      kind: 'text',
      text: 'https://example.com/p?page=2&lang=en',
    },
    trigger: 'copy',
  });
  assert.ok(payload, 'payload should not be null');
  assert.deepEqual(payload.trackingParams, [], 'trackingParams should be empty');
  assert.equal(payload.cleanHref, payload.href, 'cleanHref should equal href when no trackers');
});
