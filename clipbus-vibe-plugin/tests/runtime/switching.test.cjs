'use strict';
/**
 * switching.test.cjs — 动画切换逻辑单元测试
 * 覆盖：resolveAnimationList、buildButtons、indexForButton
 * 运行：node --test ./tests/runtime/switching.test.cjs
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

const { resolveAnimationList, buildButtons, indexForButton } =
  require(path.join(ROOT, 'src/features/vibe-fallback/switching.ts'));

const ALL = [
  { id: 'particle-core', label: 'Particle Core' },
  { id: 'text-reveal',   label: 'Text Reveal'   },
  { id: 'text-loop',     label: 'Text Loop'      },
];

// ── resolveAnimationList ──────────────────────────────────────────────────────

describe('resolveAnimationList', () => {
  it('valid array subset preserves order and length', () => {
    const result = resolveAnimationList(['text-loop', 'particle-core'], ALL);
    assert.deepEqual(result.map((m) => m.id), ['text-loop', 'particle-core']);
  });

  it('order is independent of default order', () => {
    const result = resolveAnimationList(['text-loop', 'particle-core', 'text-reveal'], ALL);
    assert.deepEqual(result.map((m) => m.id), ['text-loop', 'particle-core', 'text-reveal']);
  });

  it('unknown ids are dropped', () => {
    const result = resolveAnimationList(['text-loop', 'nope'], ALL);
    assert.deepEqual(result.map((m) => m.id), ['text-loop']);
  });

  it('duplicates are collapsed', () => {
    const result = resolveAnimationList(['text-loop', 'text-loop'], ALL);
    assert.deepEqual(result.map((m) => m.id), ['text-loop']);
  });

  it('empty array -> all 3 in default order', () => {
    const result = resolveAnimationList([], ALL);
    assert.deepEqual(result.map((m) => m.id), ['particle-core', 'text-reveal', 'text-loop']);
  });

  it('all-invalid array -> all 3 in default order', () => {
    const result = resolveAnimationList(['nope', 'also-nope'], ALL);
    assert.deepEqual(result.map((m) => m.id), ['particle-core', 'text-reveal', 'text-loop']);
  });

  it('undefined -> all 3 in default order', () => {
    const result = resolveAnimationList(undefined, ALL);
    assert.deepEqual(result.map((m) => m.id), ['particle-core', 'text-reveal', 'text-loop']);
  });

  it('null -> all 3 in default order', () => {
    const result = resolveAnimationList(null, ALL);
    assert.deepEqual(result.map((m) => m.id), ['particle-core', 'text-reveal', 'text-loop']);
  });

  it('non-list scalar number -> all 3 in default order', () => {
    const result = resolveAnimationList(42, ALL);
    assert.deepEqual(result.map((m) => m.id), ['particle-core', 'text-reveal', 'text-loop']);
  });

  it('non-list scalar object -> all 3 in default order', () => {
    const result = resolveAnimationList({}, ALL);
    assert.deepEqual(result.map((m) => m.id), ['particle-core', 'text-reveal', 'text-loop']);
  });

  it('comma/space-separated string is accepted', () => {
    const result = resolveAnimationList('text-loop, particle-core', ALL);
    assert.deepEqual(result.map((m) => m.id), ['text-loop', 'particle-core']);
  });

  it('single string id is accepted', () => {
    const result = resolveAnimationList('text-reveal', ALL);
    assert.deepEqual(result.map((m) => m.id), ['text-reveal']);
  });
});

// ── buildButtons ──────────────────────────────────────────────────────────────

describe('buildButtons', () => {
  it('length matches the list', () => {
    const list = [ALL[0], ALL[2]];
    const btns = buildButtons(list);
    assert.equal(btns.length, 2);
  });

  it('every button is enabled', () => {
    const btns = buildButtons(ALL);
    for (const btn of btns) {
      assert.equal(btn.enabled, true, `button ${btn.id} should be enabled`);
    }
  });

  it('id and title match meta id and label', () => {
    const btns = buildButtons(ALL);
    for (let i = 0; i < ALL.length; i++) {
      assert.equal(btns[i].id,    ALL[i].id);
      assert.equal(btns[i].title, ALL[i].label);
    }
  });
});

// ── indexForButton ────────────────────────────────────────────────────────────

describe('indexForButton', () => {
  it('known id returns its index in the list', () => {
    assert.equal(indexForButton(ALL, 'particle-core', 2), 0);
    assert.equal(indexForButton(ALL, 'text-reveal',   0), 1);
    assert.equal(indexForButton(ALL, 'text-loop',     0), 2);
  });

  it('unknown id returns current', () => {
    assert.equal(indexForButton(ALL, 'no-such-id', 1), 1);
    assert.equal(indexForButton(ALL, '',            2), 2);
  });
});
