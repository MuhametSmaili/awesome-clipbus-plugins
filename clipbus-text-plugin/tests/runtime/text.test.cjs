'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.resolve(root, 'manifest.json'), 'utf8'));

// ── manifest ─────────────────────────────────────────────────────────────────

test('manifest declares the 9 action ids', () => {
  const ids = manifest.actions.map((a) => a.id);
  assert.ok(ids.includes('text-sort'), 'missing text-sort');
  assert.ok(ids.includes('text-dedup'), 'missing text-dedup');
  assert.ok(ids.includes('text-trim'), 'missing text-trim');
  assert.ok(ids.includes('text-strip-ansi'), 'missing text-strip-ansi');
  assert.ok(ids.includes('text-reverse-lines'), 'missing text-reverse-lines');
  assert.ok(ids.includes('text-reverse-characters'), 'missing text-reverse-characters');
  assert.ok(ids.includes('text-sort-characters'), 'missing text-sort-characters');
  assert.ok(ids.includes('text-pretty-json'), 'missing text-pretty-json');
  assert.ok(ids.includes('text-minify-json'), 'missing text-minify-json');
  assert.equal(ids.length, 9);
});

test('all actions are lifecycle auto-run', () => {
  for (const action of manifest.actions) {
    assert.equal(action.lifecycle, 'auto-run', `${action.id} should be auto-run`);
  }
});

// ── factory shapes ───────────────────────────────────────────────────────────

test('createSortAction returns a handler with runAutoAction and resolveSession', () => {
  const { createSortAction } = require(path.resolve(root, 'src/features/line-tools/sort.ts'));
  const handler = createSortAction();
  assert.equal(typeof handler.runAutoAction, 'function');
  assert.equal(typeof handler.resolveSession, 'function');
});

test('createDedupAction returns a handler with runAutoAction and resolveSession', () => {
  const { createDedupAction } = require(path.resolve(root, 'src/features/line-tools/dedup.ts'));
  const handler = createDedupAction();
  assert.equal(typeof handler.runAutoAction, 'function');
  assert.equal(typeof handler.resolveSession, 'function');
});

test('createTrimAction returns a handler with runAutoAction and resolveSession', () => {
  const { createTrimAction } = require(path.resolve(root, 'src/features/line-tools/trim.ts'));
  const handler = createTrimAction();
  assert.equal(typeof handler.runAutoAction, 'function');
  assert.equal(typeof handler.resolveSession, 'function');
});

for (const [moduleName, factoryName] of [
  ['reverse-lines', 'createReverseLinesAction'],
  ['reverse-characters', 'createReverseCharactersAction'],
  ['sort-characters', 'createSortCharactersAction'],
  ['json', 'createPrettyJsonAction'],
  ['json', 'createMinifyJsonAction'],
]) {
  test(`${factoryName} returns a handler with runAutoAction and resolveSession`, () => {
    const actionModule = require(path.resolve(root, `src/features/line-tools/${moduleName}.ts`));
    const handler = actionModule[factoryName]();
    assert.equal(typeof handler.runAutoAction, 'function');
    assert.equal(typeof handler.resolveSession, 'function');
  });
}

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

// ── action wiring ────────────────────────────────────────────────────────────

function makeInput(text) {
  return {
    item: { id: 'test', type: 'text', tags: [], sourceAppID: '' },
    content: { kind: 'text', text },
    attachments: [],
  };
}

test('sort action on multi-line text returns resultKind text with sorted output', async () => {
  const { createSortAction } = require(path.resolve(root, 'src/features/line-tools/sort.ts'));
  const handler = createSortAction();
  const result = await handler.runAutoAction(makeInput('b\na'));
  assert.equal(result.result.resultKind, 'text');
  assert.equal(result.result.text, 'a\nb');
});

test('dedup action removes duplicates', async () => {
  const { createDedupAction } = require(path.resolve(root, 'src/features/line-tools/dedup.ts'));
  const handler = createDedupAction();
  const result = await handler.runAutoAction(makeInput('a\na\nb'));
  assert.equal(result.result.resultKind, 'text');
  assert.equal(result.result.text, 'a\nb');
});

test('trim action tidies whitespace', async () => {
  const { createTrimAction } = require(path.resolve(root, 'src/features/line-tools/trim.ts'));
  const handler = createTrimAction();
  const result = await handler.runAutoAction(makeInput('  x  \n\n\n\ny  '));
  assert.equal(result.result.resultKind, 'text');
  assert.equal(result.result.text, 'x\n\ny');
});

test('reverse lines action reverses line order', async () => {
  const { createReverseLinesAction } = require(path.resolve(root, 'src/features/line-tools/reverse-lines.ts'));
  const result = await createReverseLinesAction().runAutoAction(makeInput('one\ntwo\nthree'));
  assert.equal(result.result.resultKind, 'text');
  assert.equal(result.result.text, 'three\ntwo\none');
});

test('reverse characters action reverses all graphemes', async () => {
  const { createReverseCharactersAction } = require(path.resolve(root, 'src/features/line-tools/reverse-characters.ts'));
  const result = await createReverseCharactersAction().runAutoAction(makeInput('abc👍🏽'));
  assert.equal(result.result.resultKind, 'text');
  assert.equal(result.result.text, '👍🏽cba');
});

test('sort characters action sorts all graphemes', async () => {
  const { createSortCharactersAction } = require(path.resolve(root, 'src/features/line-tools/sort-characters.ts'));
  const result = await createSortCharactersAction().runAutoAction(makeInput('cba'));
  assert.equal(result.result.resultKind, 'text');
  assert.equal(result.result.text, 'abc');
});

test('pretty JSON action formats valid JSON with two-space indentation', async () => {
  const { createPrettyJsonAction } = require(path.resolve(root, 'src/features/line-tools/json.ts'));
  const result = await createPrettyJsonAction().runAutoAction(makeInput('{"a":1,"nested":{"ok":true}}'));
  assert.equal(result.result.resultKind, 'text');
  assert.equal(result.result.text, '{\n  "a": 1,\n  "nested": {\n    "ok": true\n  }\n}');
});

test('minify JSON action removes insignificant whitespace', async () => {
  const { createMinifyJsonAction } = require(path.resolve(root, 'src/features/line-tools/json.ts'));
  const result = await createMinifyJsonAction().runAutoAction(makeInput('{ "a": 1, "items": [true, null] }'));
  assert.equal(result.result.resultKind, 'text');
  assert.equal(result.result.text, '{"a":1,"items":[true,null]}');
});

for (const factoryName of ['createPrettyJsonAction', 'createMinifyJsonAction']) {
  test(`${factoryName} returns none for invalid JSON`, async () => {
    const actionModule = require(path.resolve(root, 'src/features/line-tools/json.ts'));
    const result = await actionModule[factoryName]().runAutoAction(makeInput('{"broken":'));
    assert.equal(result.result.resultKind, 'none');
    assert.equal(result.userMessage, 'Invalid JSON');
  });
}

test('sort action on empty text returns resultKind none', async () => {
  const { createSortAction } = require(path.resolve(root, 'src/features/line-tools/sort.ts'));
  const handler = createSortAction();
  const result = await handler.runAutoAction(makeInput(''));
  assert.equal(result.result.resultKind, 'none');
});

test('dedup action on empty text returns resultKind none', async () => {
  const { createDedupAction } = require(path.resolve(root, 'src/features/line-tools/dedup.ts'));
  const handler = createDedupAction();
  const result = await handler.runAutoAction(makeInput(''));
  assert.equal(result.result.resultKind, 'none');
});

test('trim action on whitespace-only text returns resultKind none', async () => {
  const { createTrimAction } = require(path.resolve(root, 'src/features/line-tools/trim.ts'));
  const handler = createTrimAction();
  const result = await handler.runAutoAction(makeInput('   \n  \n  '));
  assert.equal(result.result.resultKind, 'none');
});

for (const [moduleName, factoryName] of [
  ['reverse-lines', 'createReverseLinesAction'],
  ['reverse-characters', 'createReverseCharactersAction'],
  ['sort-characters', 'createSortCharactersAction'],
]) {
  test(`${moduleName} action on empty text returns resultKind none`, async () => {
    const actionModule = require(path.resolve(root, `src/features/line-tools/${moduleName}.ts`));
    const result = await actionModule[factoryName]().runAutoAction(makeInput(''));
    assert.equal(result.result.resultKind, 'none');
  });
}
