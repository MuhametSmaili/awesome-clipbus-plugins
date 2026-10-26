'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const { attachment } = require(path.join(root, "src/features/json-renderer/payload.ts"));
const manifest = JSON.parse(fs.readFileSync(path.resolve(root, 'manifest.json'), 'utf8'));

const sampleItem = {
  id: 'item-1',
  kind: 'text',
  tags: [],
  sourceApp: 'com.example.app',
};

// ---------------------------------------------------------------------------
// Manifest shape
// ---------------------------------------------------------------------------

test('manifest has json-detector', () => {
  const ids = manifest.detectors.map((d) => d.id);
  assert.ok(ids.includes('json-detector'), 'missing json-detector');
});

test('manifest has json-renderer', () => {
  const ids = manifest.renderers.map((r) => r.id);
  assert.ok(ids.includes('json-renderer'), 'missing json-renderer');
});

test('json-renderer page references renderers/ path', () => {
  const renderer = manifest.renderers.find((r) => r.id === 'json-renderer');
  assert.ok(renderer.page.startsWith('dist/ui/renderers/'), `unexpected page: ${renderer.page}`);
});

// ---------------------------------------------------------------------------
// Detector / payload
// ---------------------------------------------------------------------------

test('detector detects minified JSON object and formats it', async () => {
  const { createJsonPayload } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  const input = {
    item: sampleItem,
    content: { kind: 'text', text: '{"name":"Alice","age":30}' },
  };
  const payload = createJsonPayload(input);
  assert.ok(payload, 'payload should not be null for valid JSON');
  assert.equal(attachment.type, 'plugin.formatter.json');
  assert.equal(payload.kind, 'json_formatter_preview');
  assert.equal(payload.topLevelType, 'object');
  assert.equal(payload.topLevelCount, 2);
  assert.ok(payload.formatted.includes('  "name"'), 'formatted JSON should have indentation');
});

test('detector detects JSON array', async () => {
  const { createJsonPayload } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  const input = {
    item: sampleItem,
    content: { kind: 'text', text: '[1, 2, 3]' },
  };
  const payload = createJsonPayload(input);
  assert.ok(payload, 'should detect JSON array');
  assert.equal(payload.topLevelType, 'array');
  assert.equal(payload.topLevelCount, 3);
});

test('detector ignores plain text', () => {
  const { createJsonPayload } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  const payload = createJsonPayload({
    item: sampleItem,
    content: { kind: 'text', text: 'hello world' },
  });
  assert.equal(payload, null, 'plain text should not be detected as JSON');
});

test('detector ignores invalid JSON', () => {
  const { createJsonPayload } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  const payload = createJsonPayload({
    item: sampleItem,
    content: { kind: 'text', text: '{bad json}' },
  });
  assert.equal(payload, null, 'invalid JSON should not be detected');
});

test('detector ignores image content kind', () => {
  const { createJsonPayload } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  const payload = createJsonPayload({
    item: sampleItem,
    content: { kind: 'image', width: 100, height: 100, format: 'png', bytes: 0 },
  });
  assert.equal(payload, null, 'image kind should not produce JSON payload');
});

test('decodeJsonPayload returns null for bad payloads', () => {
  const { decodeJsonPayload } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  assert.equal(decodeJsonPayload('not-json'), null);
  assert.equal(decodeJsonPayload('{"kind":"other"}'), null);
  assert.equal(decodeJsonPayload(null), null);
  assert.equal(decodeJsonPayload(undefined), null);
});

test('decodeJsonPayload accepts a structured V2 attachment payload', () => {
  const { createJsonPayload, decodeJsonPayload } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  const payload = createJsonPayload({ content: { kind: 'text', text: '{"a":1}' } });
  assert.deepEqual(decodeJsonPayload(payload), payload);
});

// ---------------------------------------------------------------------------
// jsonToYaml
// ---------------------------------------------------------------------------

test('jsonToYaml: nested object with array value', () => {
  const { jsonToYaml } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  const result = jsonToYaml({ name: 'api', ports: [80, 443], enabled: true });
  assert.equal(result, 'name: api\nports:\n  - 80\n  - 443\nenabled: true');
});

test('jsonToYaml: string containing ": " is double-quoted', () => {
  const { jsonToYaml } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  assert.equal(jsonToYaml({ key: 'value: with colon' }), 'key: "value: with colon"');
});

test('jsonToYaml: string "true" is double-quoted (would parse as bool)', () => {
  const { jsonToYaml } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  assert.equal(jsonToYaml({ flag: 'true' }), 'flag: "true"');
});

test('jsonToYaml: string "123" is double-quoted (would parse as number)', () => {
  const { jsonToYaml } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  assert.equal(jsonToYaml({ count: '123' }), 'count: "123"');
});

test('jsonToYaml: empty string is double-quoted', () => {
  const { jsonToYaml } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  assert.equal(jsonToYaml({ val: '' }), 'val: ""');
});

test('jsonToYaml: multiline string is double-quoted with \\n escape', () => {
  const { jsonToYaml } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  assert.equal(jsonToYaml({ msg: 'line1\nline2' }), 'msg: "line1\\nline2"');
});

test('jsonToYaml: null, boolean, and number scalars', () => {
  const { jsonToYaml } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  assert.equal(jsonToYaml({ n: null, b: true, i: 42 }), 'n: null\nb: true\ni: 42');
});

test('jsonToYaml: empty object and empty array values', () => {
  const { jsonToYaml } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  assert.equal(jsonToYaml({ obj: {}, arr: [] }), 'obj: {}\narr: []');
});

test('jsonToYaml: payload yaml field populated on detect', () => {
  const { createJsonPayload } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  const payload = createJsonPayload({
    item: sampleItem,
    content: { kind: 'text', text: '{"a":1,"b":[2,3]}' },
  });
  assert.ok(typeof payload.yaml === 'string', 'yaml field should be a string');
  assert.ok(payload.yaml.includes('a: 1'), 'yaml should contain key a');
  assert.ok(payload.yaml.includes('- 2'), 'yaml should contain array item 2');
});

test('jsonToYaml: decodeJsonPayload fills missing yaml with empty string', () => {
  const { decodeJsonPayload } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  const legacyPayload = JSON.stringify({
    kind: 'json_formatter_preview',
    version: 1,
    originalLength: 7,
    formatted: '{\n  "x": 1\n}',
    formattedLength: 12,
    topLevelType: 'object',
    topLevelCount: 1,
    display: { typeLabel: 'JSON Object', headline: 'JSON Object · 1 keys', subheadline: '7 → 12 chars' },
  });
  const decoded = decodeJsonPayload(legacyPayload);
  assert.ok(decoded !== null, 'should decode successfully');
  assert.equal(decoded.yaml, '', 'yaml defaults to empty string for legacy payloads');
});

// ---------------------------------------------------------------------------
// Minified JSON
// ---------------------------------------------------------------------------

test('minified field is compact: no newlines, no double spaces', () => {
  const { createJsonPayload } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  const payload = createJsonPayload({
    item: sampleItem,
    content: { kind: 'text', text: '{"a":1,"b":[2,{"c":true}]}' },
  });
  assert.ok(payload, 'payload should not be null');
  assert.ok(typeof payload.minified === 'string', 'minified field should be a string');
  assert.ok(!payload.minified.includes('\n'), 'minified should contain no newlines');
  assert.ok(!payload.minified.includes('  '), 'minified should contain no double spaces');
});

test('minified is lossless: JSON.parse(minified) deep-equals original', () => {
  const { createJsonPayload } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  const original = { name: 'api', ports: [80, 443], enabled: true, meta: { v: 2 } };
  const payload = createJsonPayload({
    item: sampleItem,
    content: { kind: 'text', text: JSON.stringify(original) },
  });
  assert.ok(payload, 'payload should not be null');
  assert.deepEqual(JSON.parse(payload.minified), original, 'minified round-trips losslessly');
});

test('decodeJsonPayload fills missing minified with empty string', () => {
  const { decodeJsonPayload } = require(path.resolve(root, 'src/features/json-renderer/payload.ts'));
  const legacyPayload = JSON.stringify({
    kind: 'json_formatter_preview',
    version: 1,
    originalLength: 7,
    formatted: '{\n  "x": 1\n}',
    formattedLength: 12,
    yaml: '',
    topLevelType: 'object',
    topLevelCount: 1,
    display: { typeLabel: 'JSON Object', headline: 'JSON Object · 1 keys', subheadline: '7 → 12 chars' },
  });
  const decoded = decodeJsonPayload(legacyPayload);
  assert.ok(decoded !== null, 'should decode successfully');
  assert.equal(decoded.minified, '', 'minified defaults to empty string for legacy payloads');
});
