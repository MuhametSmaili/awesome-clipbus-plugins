'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  fakeHost, imageContent, itemSnapshot, setupPlugin, textContent,
} = require('../support/plugin.cjs');

const root = path.resolve(__dirname, '../..');

// ── pure stripAnsi unit tests ─────────────────────────────────────────────────

test('stripAnsi removes SGR color codes', () => {
  const { stripAnsi } = require(path.resolve(root, 'src/features/line-tools/transforms.ts'));
  assert.equal(stripAnsi('\x1b[31mred\x1b[0m'), 'red');
});

test('stripAnsi removes bold+color compound SGR', () => {
  const { stripAnsi } = require(path.resolve(root, 'src/features/line-tools/transforms.ts'));
  assert.equal(stripAnsi('\x1b[1;32mok\x1b[0m done'), 'ok done');
});

test('stripAnsi removes OSC title sequence terminated by BEL', () => {
  const { stripAnsi } = require(path.resolve(root, 'src/features/line-tools/transforms.ts'));
  // ESC ] 0 ; title BEL  followed by plain text
  assert.equal(stripAnsi('\x1b]0;title\x07hi'), 'hi');
});

test('stripAnsi leaves plain text unchanged', () => {
  const { stripAnsi } = require(path.resolve(root, 'src/features/line-tools/transforms.ts'));
  assert.equal(stripAnsi('hello\nworld'), 'hello\nworld');
});

test('stripAnsi handles empty string', () => {
  const { stripAnsi } = require(path.resolve(root, 'src/features/line-tools/transforms.ts'));
  assert.equal(stripAnsi(''), '');
});

for (const [label, content, expected] of [
  ['SGR codes', textContent('\x1b[31mred\x1b[0m'), { kind: 'text', text: 'red' }],
  ['plain text', textContent('hello\nworld'), { kind: 'text', text: 'hello\nworld' }],
  ['empty text', textContent(''), { kind: 'none' }],
  ['image input', imageContent, { kind: 'none' }],
]) {
  test(`built strip-ansi action handles ${label}`, async t => {
    const { registry, launch } = await setupPlugin(t);
    const host = fakeHost(launch);
    const output = await registry.actions['text-strip-ansi']({
      item: itemSnapshot(content.kind), content,
    }, host.ctx);
    assert.deepEqual(output.result, expected);
    assert.equal(output.message, expected.kind === 'none' ? 'Nothing to process' : 'Done');
    assert.deepEqual(host.calls, []);
  });
}
