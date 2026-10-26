'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const { attachment } = require(path.join(root, "src/features/csv-table/payload.ts"));
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

test('manifest has csv-detector', () => {
  const ids = manifest.detectors.map((d) => d.id);
  assert.ok(ids.includes('csv-detector'), 'missing csv-detector');
});

test('manifest has csv-table renderer', () => {
  const ids = manifest.renderers.map((r) => r.id);
  assert.ok(ids.includes('csv-table'), 'missing csv-table');
});

test('csv-table page references renderers/ path', () => {
  const renderer = manifest.renderers.find((r) => r.id === 'csv-table');
  assert.ok(renderer.page.startsWith('dist/ui/renderers/'), `unexpected page: ${renderer.page}`);
});

// ---------------------------------------------------------------------------
// Payload factories — feature files required directly (not src/plugin.ts)
// ---------------------------------------------------------------------------

test('each factory file exports expected function', () => {
  const { attachment, createCsvPayload, decodeCsvPayload } =
    require(path.resolve(root, 'src/features/csv-table/payload.ts'));
  assert.equal(attachment.type, 'plugin.formatter.csv');
  assert.equal(typeof createCsvPayload, 'function');
  assert.equal(typeof decodeCsvPayload, 'function');

  const { createCsvDetector } =
    require(path.resolve(root, 'src/features/csv-table/detector.ts'));
  assert.equal(typeof createCsvDetector, 'function');

});

// ---------------------------------------------------------------------------
// Detector / payload — comma-delimited
// ---------------------------------------------------------------------------

test('createCsvPayload detects comma-delimited CSV', () => {
  const { createCsvPayload } =
    require(path.resolve(root, 'src/features/csv-table/payload.ts'));
  const input = {
    item: sampleItem,
    content: { kind: 'text', text: 'name,age\nAlice,30\nBob,25' },
  };
  const payload = createCsvPayload(input);
  assert.ok(payload, 'payload should not be null for valid CSV');
  assert.equal(attachment.type, 'plugin.formatter.csv');
  assert.equal(payload.kind, 'csv_table');
  assert.equal(payload.colCount, 2);
  assert.equal(payload.rowCount, 2);
  assert.deepEqual(payload.headers, ['name', 'age']);
});

// ---------------------------------------------------------------------------
// Tab-delimited
// ---------------------------------------------------------------------------

test('createCsvPayload detects tab-delimited CSV with correct delimiter', () => {
  const { createCsvPayload } =
    require(path.resolve(root, 'src/features/csv-table/payload.ts'));
  const input = {
    item: sampleItem,
    content: { kind: 'text', text: 'name\tage\nAlice\t30\nBob\t25' },
  };
  const payload = createCsvPayload(input);
  assert.ok(payload, 'tab CSV should be detected');
  assert.equal(payload.delimiter, '\t');
});

// ---------------------------------------------------------------------------
// Quoted field with embedded delimiter
// ---------------------------------------------------------------------------

test('createCsvPayload parses quoted cell containing comma', () => {
  const { createCsvPayload } =
    require(path.resolve(root, 'src/features/csv-table/payload.ts'));
  // Header row: a, "x, y", c  -> 3 columns; middle header should be "x, y"
  const input = {
    item: sampleItem,
    content: { kind: 'text', text: 'a,"x, y",c\n1,2,3' },
  };
  const payload = createCsvPayload(input);
  assert.ok(payload, 'quoted comma CSV should be detected');
  assert.equal(payload.colCount, 3);
  assert.equal(payload.headers[1], 'x, y');
});

// ---------------------------------------------------------------------------
// Rejection cases
// ---------------------------------------------------------------------------

test('createCsvPayload returns null for plain prose (single line)', () => {
  const { createCsvPayload } =
    require(path.resolve(root, 'src/features/csv-table/payload.ts'));
  const payload = createCsvPayload({
    item: sampleItem,
    content: { kind: 'text', text: 'just a normal sentence, nothing tabular' },
  });
  assert.equal(payload, null);
});

test('createCsvPayload returns null for one-column list (colCount < 2)', () => {
  const { createCsvPayload } =
    require(path.resolve(root, 'src/features/csv-table/payload.ts'));
  const payload = createCsvPayload({
    item: sampleItem,
    content: { kind: 'text', text: 'a\nb\nc' },
  });
  assert.equal(payload, null);
});

test('createCsvPayload returns null for image content kind', () => {
  const { createCsvPayload } =
    require(path.resolve(root, 'src/features/csv-table/payload.ts'));
  const payload = createCsvPayload({
    item: sampleItem,
    content: { kind: 'image', width: 100, height: 100, format: 'png', bytes: 0 },
  });
  assert.equal(payload, null);
});

// ---------------------------------------------------------------------------
// decodeCsvPayload
// ---------------------------------------------------------------------------

test('decodeCsvPayload returns null for bad inputs', () => {
  const { decodeCsvPayload } =
    require(path.resolve(root, 'src/features/csv-table/payload.ts'));
  assert.equal(decodeCsvPayload('not-json'), null);
  assert.equal(decodeCsvPayload('{"kind":"other"}'), null);
  assert.equal(decodeCsvPayload(null), null);
  assert.equal(decodeCsvPayload(undefined), null);
});

test('decodeCsvPayload accepts a structured V2 attachment payload', () => {
  const { createCsvPayload, decodeCsvPayload } = require(path.resolve(root, 'src/features/csv-table/payload.ts'));
  const payload = createCsvPayload({ content: { kind: 'text', text: 'name,age\nAlice,30' } });
  assert.deepEqual(decodeCsvPayload(payload), payload);
});

// ---------------------------------------------------------------------------
// buildCsvJson
// ---------------------------------------------------------------------------

test('buildCsvJson exports factory exists', () => {
  const { buildCsvJson } =
    require(path.resolve(root, 'src/features/csv-table/payload.ts'));
  assert.equal(typeof buildCsvJson, 'function');
});

test('buildCsvJson produces correct JSON for a 3-column 2-row CSV', () => {
  const { buildCsvJson } =
    require(path.resolve(root, 'src/features/csv-table/payload.ts'));
  const payload = {
    kind: 'csv_table',
    version: 1,
    delimiter: ',',
    headers: ['name', 'age', 'city'],
    rows: [
      ['Alice', '30', 'London'],
      ['Bob', '25', 'Paris'],
    ],
    rowCount: 2,
    colCount: 3,
    display: { typeLabel: 'CSV Table', headline: '3×2', facts: [] },
  };
  const result = buildCsvJson(payload);
  const parsed = JSON.parse(result);
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0], { name: 'Alice', age: '30', city: 'London' });
  assert.deepEqual(parsed[1], { name: 'Bob', age: '25', city: 'Paris' });
  // Values are strings, not numbers
  assert.equal(typeof parsed[0].age, 'string');
});

test('buildCsvJson preserves quoted field containing a comma as single value', () => {
  const { buildCsvJson } =
    require(path.resolve(root, 'src/features/csv-table/payload.ts'));
  // The payload already has the parsed (unquoted) value; the comma inside is
  // a regular string character — JSON export must not split or escape it.
  const payload = {
    kind: 'csv_table',
    version: 1,
    delimiter: ',',
    headers: ['name', 'note'],
    rows: [['Alice', 'handles, UX & motion']],
    rowCount: 1,
    colCount: 2,
    display: { typeLabel: 'CSV Table', headline: '2×1', facts: [] },
  };
  const result = buildCsvJson(payload);
  const parsed = JSON.parse(result);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].note, 'handles, UX & motion');
});

test('buildCsvJson fills missing cells with empty string (ragged row)', () => {
  const { buildCsvJson } =
    require(path.resolve(root, 'src/features/csv-table/payload.ts'));
  const payload = {
    kind: 'csv_table',
    version: 1,
    delimiter: ',',
    headers: ['a', 'b', 'c'],
    rows: [
      ['x', 'y'],       // missing 'c'
      ['1', '2', '3'],  // full row
    ],
    rowCount: 2,
    colCount: 3,
    display: { typeLabel: 'CSV Table', headline: '3×2', facts: [] },
  };
  const result = buildCsvJson(payload);
  const parsed = JSON.parse(result);
  assert.equal(parsed[0].c, '', 'missing cell should be empty string');
  assert.equal(parsed[1].c, '3');
});
