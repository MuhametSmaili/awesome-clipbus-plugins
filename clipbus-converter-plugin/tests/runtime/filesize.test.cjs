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

// ---------------------------------------------------------------------------
// Manifest shape
// ---------------------------------------------------------------------------

test('manifest has filesize-detector', () => {
  const ids = manifest.detectors.map((d) => d.id);
  assert.ok(ids.includes('filesize-detector'), 'missing filesize-detector');
});

test('manifest has filesize-renderer', () => {
  const ids = manifest.renderers.map((r) => r.id);
  assert.ok(ids.includes('filesize-renderer'), 'missing filesize-renderer');
});

test('filesize-renderer page references renderers/ path', () => {
  const renderer = manifest.renderers.find((r) => r.id === 'filesize-renderer');
  assert.ok(renderer.page.startsWith('dist/ui/renderers/'), `unexpected page: ${renderer.page}`);
});



// ---------------------------------------------------------------------------
// parseSize
// ---------------------------------------------------------------------------

test('parseSize: 1.5 GB → 1,500,000,000 bytes', () => {
  const { parseSize } = require(path.resolve(root, 'src/features/filesize-renderer/payload.ts'));
  const result = parseSize('1.5 GB');
  assert.ok(result, 'should parse 1.5 GB');
  assert.equal(result.bytes, 1_500_000_000);
});

test('parseSize: 1 GiB → 1,073,741,824 bytes', () => {
  const { parseSize } = require(path.resolve(root, 'src/features/filesize-renderer/payload.ts'));
  const result = parseSize('1 GiB');
  assert.ok(result, 'should parse 1 GiB');
  assert.equal(result.bytes, 1_073_741_824);
});

test('parseSize: 1 KB → 1000 bytes (SI)', () => {
  const { parseSize } = require(path.resolve(root, 'src/features/filesize-renderer/payload.ts'));
  const result = parseSize('1 KB');
  assert.ok(result, 'should parse 1 KB');
  assert.equal(result.bytes, 1000);
});

test('parseSize: 1 KiB → 1024 bytes (IEC)', () => {
  const { parseSize } = require(path.resolve(root, 'src/features/filesize-renderer/payload.ts'));
  const result = parseSize('1 KiB');
  assert.ok(result, 'should parse 1 KiB');
  assert.equal(result.bytes, 1024);
});

test('parseSize: 1 KB !== 1 KiB (SI vs IEC)', () => {
  const { parseSize } = require(path.resolve(root, 'src/features/filesize-renderer/payload.ts'));
  const si = parseSize('1 KB');
  const iec = parseSize('1 KiB');
  assert.notEqual(si.bytes, iec.bytes, '1 KB and 1 KiB should differ');
});

test('parseSize: 1,536 bytes → 1536 (comma stripped)', () => {
  const { parseSize } = require(path.resolve(root, 'src/features/filesize-renderer/payload.ts'));
  const result = parseSize('1,536 bytes');
  assert.ok(result, 'should parse 1,536 bytes');
  assert.equal(result.bytes, 1536);
});

test('parseSize: 500mb lowercase parses', () => {
  const { parseSize } = require(path.resolve(root, 'src/features/filesize-renderer/payload.ts'));
  const result = parseSize('500mb');
  assert.ok(result, 'should parse 500mb');
  assert.equal(result.bytes, 500_000_000);
});

test('parseSize: bare 1536 (no unit) → null (no radix collision)', () => {
  const { parseSize } = require(path.resolve(root, 'src/features/filesize-renderer/payload.ts'));
  const result = parseSize('1536');
  assert.equal(result, null, 'bare integer without unit must not match');
});

test('parseSize: prose text → null', () => {
  const { parseSize } = require(path.resolve(root, 'src/features/filesize-renderer/payload.ts'));
  assert.equal(parseSize('hello world'), null);
  assert.equal(parseSize('transfer 500'), null);
  assert.equal(parseSize(''), null);
});

// ---------------------------------------------------------------------------
// createFilesizePayload
// ---------------------------------------------------------------------------

test('createFilesizePayload returns correct attachmentType', () => {
  const { createFilesizePayload } = require(path.resolve(root, 'src/features/filesize-renderer/payload.ts'));
  const input = { item: sampleItem, content: { kind: 'text', text: '1.5 GB' }, attachments: [] };
  const artifact = createFilesizePayload(input);
  assert.ok(artifact, 'artifact should not be null');
});

test('createFilesizePayload payload has correct byte count for 1.5 GB', () => {
  const { createFilesizePayload } = require(path.resolve(root, 'src/features/filesize-renderer/payload.ts'));
  const input = { item: sampleItem, content: { kind: 'text', text: '1.5 GB' }, attachments: [] };
  const artifact = createFilesizePayload(input);
  const payload = artifact;
  assert.equal(payload.bytes, 1_500_000_000);
  assert.equal(payload.kind, 'filesize_preview');
});

test('createFilesizePayload payload has SI and IEC breakdowns', () => {
  const { createFilesizePayload } = require(path.resolve(root, 'src/features/filesize-renderer/payload.ts'));
  const input = { item: sampleItem, content: { kind: 'text', text: '1.5 GB' }, attachments: [] };
  const artifact = createFilesizePayload(input);
  const payload = artifact;
  assert.ok(Array.isArray(payload.siUnits), 'siUnits should be an array');
  assert.ok(Array.isArray(payload.iecUnits), 'iecUnits should be an array');
  assert.ok(payload.naturalSI, 'naturalSI should be present');
  assert.ok(payload.naturalIEC, 'naturalIEC should be present');
});

test('createFilesizePayload: natural SI unit for 1.5 GB is GB', () => {
  const { createFilesizePayload } = require(path.resolve(root, 'src/features/filesize-renderer/payload.ts'));
  const input = { item: sampleItem, content: { kind: 'text', text: '1.5 GB' }, attachments: [] };
  const artifact = createFilesizePayload(input);
  const payload = artifact;
  assert.equal(payload.naturalSI.unit, 'GB');
});

test('createFilesizePayload: natural IEC unit for 1.5 GB is GiB', () => {
  const { createFilesizePayload } = require(path.resolve(root, 'src/features/filesize-renderer/payload.ts'));
  const input = { item: sampleItem, content: { kind: 'text', text: '1.5 GB' }, attachments: [] };
  const artifact = createFilesizePayload(input);
  const payload = artifact;
  assert.equal(payload.naturalIEC.unit, 'GiB');
});

test('createFilesizePayload returns null for bare integer', () => {
  const { createFilesizePayload } = require(path.resolve(root, 'src/features/filesize-renderer/payload.ts'));
  const input = { item: sampleItem, content: { kind: 'text', text: '1536' }, attachments: [] };
  const artifact = createFilesizePayload(input);
  assert.equal(artifact, null, 'bare integer must not produce filesize artifact');
});

// ---------------------------------------------------------------------------
// decodeFilesizePayload
// ---------------------------------------------------------------------------

test('decodeFilesizePayload returns null for invalid inputs', () => {
  const { decodeFilesizePayload } = require(path.resolve(root, 'src/features/filesize-renderer/payload.ts'));
  assert.equal(decodeFilesizePayload('not-json'), null);
  assert.equal(decodeFilesizePayload('{"kind":"other"}'), null);
  assert.equal(decodeFilesizePayload(null), null);
  assert.equal(decodeFilesizePayload(undefined), null);
});

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
