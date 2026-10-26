'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  fakeHost, imageContent, itemSnapshot, manifest, setupPlugin, textContent,
} = require('../support/plugin.cjs');

const root = path.resolve(__dirname, '../..');

test('manifest declares the 9 text action ids', () => {
  assert.deepEqual(manifest.actions.map(a => a.id).sort(), [
    'text-sort', 'text-dedup', 'text-trim', 'text-strip-ansi',
    'text-reverse-lines', 'text-reverse-characters', 'text-sort-characters',
    'text-pretty-json', 'text-minify-json',
  ].sort());
});

test('all actions accept text through protocol V2', () => {
  assert.equal(manifest.schemaVersion, 5);
  for (const action of manifest.actions) {
    assert.deepEqual(action.inputKinds, ['text'], action.id);
    assert.equal(action.lifecycle, undefined, action.id);
    assert.equal(action.uiEntry, undefined, action.id);
  }
});

// ── pure transform unit tests ─────────────────────────────────────────────────

test('sortLines sorts alphabetically case-insensitive with natural numeric order', () => {
  const { sortLines } = require(path.resolve(root, 'src/features/line-tools/transforms.ts'));
  assert.equal(sortLines('b\na\nc'), 'a\nb\nc');
  assert.equal(sortLines('banana\napple\ncherry'), 'apple\nbanana\ncherry');
});

test('dedupLines removes duplicate lines preserving first occurrence', () => {
  const { dedupLines } = require(path.resolve(root, 'src/features/line-tools/transforms.ts'));
  assert.equal(dedupLines('a\na\nb\na'), 'a\nb');
});

test('tidyWhitespace trims trailing spaces, collapses blank lines, trims edges', () => {
  const { tidyWhitespace } = require(path.resolve(root, 'src/features/line-tools/transforms.ts'));
  assert.equal(tidyWhitespace('  x  \n\n\n\ny  '), 'x\n\ny');
});

test('reverseLines reverses lines and normalizes line endings', () => {
  const { reverseLines } = require(path.resolve(root, 'src/features/line-tools/transforms.ts'));
  assert.equal(reverseLines('first\r\nsecond\r\nthird'), 'third\nsecond\nfirst');
});

test('reverseCharacters reverses graphemes without splitting combined characters', () => {
  const { reverseCharacters } = require(path.resolve(root, 'src/features/line-tools/transforms.ts'));
  assert.equal(reverseCharacters('A👍🏽e\u0301'), 'e\u0301👍🏽A');
});

test('sortCharacters sorts graphemes case-insensitively with natural numeric order', () => {
  const { sortCharacters } = require(path.resolve(root, 'src/features/line-tools/transforms.ts'));
  assert.equal(sortCharacters('b10A2a'), '012Aab');
});

// Actions are exercised through the delivered bundle, as the Host calls them.
const samples = [
  ['text-sort', 'b\na', 'a\nb'],
  ['text-dedup', 'a\na\nb', 'a\nb'],
  ['text-trim', '  x  \n\n\n\ny  ', 'x\n\ny'],
  ['text-reverse-lines', 'one\ntwo\nthree', 'three\ntwo\none'],
  ['text-reverse-characters', 'abc👍🏽', '👍🏽cba'],
  ['text-sort-characters', 'cba', 'abc'],
  ['text-pretty-json', '{"a":1,"nested":{"ok":true}}', '{\n  "a": 1,\n  "nested": {\n    "ok": true\n  }\n}'],
  ['text-minify-json', '{ "a": 1, "items": [true, null] }', '{"a":1,"items":[true,null]}'],
];

for (const [id, input, expected] of samples) {
  test(`${id} returns the transformed text`, async t => {
    const { registry, launch } = await setupPlugin(t);
    const host = fakeHost(launch);
    const output = await registry.actions[id]({
      item: itemSnapshot('text'), content: textContent(input),
    }, host.ctx);
    assert.deepEqual(output, { result: { kind: 'text', text: expected }, message: 'Done' });
    assert.deepEqual(host.calls, []);
  });
}

for (const { id } of manifest.actions) {
  for (const [label, content] of [
    ['empty text', textContent('')],
    ['whitespace-only text', textContent('   \n  \n  ')],
    ['an image', imageContent],
  ]) {
    test(`${id} returns none for ${label}`, async t => {
      const { registry, launch } = await setupPlugin(t);
      const host = fakeHost(launch);
      const output = await registry.actions[id]({
        item: itemSnapshot(content.kind), content,
      }, host.ctx);
      assert.deepEqual(output, { result: { kind: 'none' }, message: 'Nothing to process' });
      assert.deepEqual(host.calls, []);
    });
  }
}

for (const id of ['text-pretty-json', 'text-minify-json']) {
  test(`${id} returns none for invalid JSON`, async t => {
    const { registry, launch } = await setupPlugin(t);
    const host = fakeHost(launch);
    const output = await registry.actions[id]({
      item: itemSnapshot('text'), content: textContent('{"broken":'),
    }, host.ctx);
    assert.deepEqual(output, { result: { kind: 'none' }, message: 'Invalid JSON' });
    assert.deepEqual(host.calls, []);
  });
}
