'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { PLUGIN_WRITE_LIMITS } = require('@clipbus/plugin-sdk');
const { manifest, setupPlugin, fakeHost, itemSnapshot, textContent, imageContent } = require('../support/plugin.cjs');
const { ATTACHMENT_TYPE, vibeAttachment, decodeVibePayload, createVibePayload } =
  require('../../src/features/vibe-fallback/payload.ts');

const ownReference = { type: ATTACHMENT_TYPE, key: 'primary', updatedAt: 1, own: true };
const foreignReference = { type: 'plugin.decoder.base64', key: 'x', updatedAt: 2, own: false };
const validPayload = { kind: 'vibe_fallback', version: 1, text: 'hello world', charCount: 11 };

describe('manifest', () => {
  it('keeps plugin.vibe identity and declares V2 writes', () => {
    assert.equal(manifest.plugin.id, 'plugin.vibe');
    assert.equal(manifest.schemaVersion, 5);
    assert.deepEqual(manifest.writes.attachmentTypes, [ATTACHMENT_TYPE]);
    assert.ok(manifest.writes.attachmentTypes.every(type => type.startsWith('plugin.vibe.')));
    assert.deepEqual(manifest.writes.searchScopes, []);
  });

  it('declares vibe-detector for text input', () => {
    assert.equal(manifest.detectors[0].id, 'vibe-detector');
    assert.deepEqual(manifest.detectors[0].inputKinds, ['text']);
  });

  it('declares the fixed-height Vibe card and all three default buttons', () => {
    const renderer = manifest.renderers[0];
    assert.equal(renderer.id, 'vibe-fallback');
    assert.equal(renderer.attachmentType, ATTACHMENT_TYPE);
    assert.equal(renderer.page, 'dist/ui/renderers/vibe-fallback/index.html');
    assert.equal(renderer.title, 'Vibe');
    assert.equal(renderer.tint, '#7C5CFF');
    assert.deepEqual(renderer.height, { min: 220, max: 220 });
    assert.deepEqual(renderer.buttons.map(button => button.id), ['particle-core', 'text-reveal', 'text-loop']);
    assert.deepEqual(manifest.actions, []);
  });
});

describe('payload', () => {
  it('creates a typed attachment payload for trimmed text', () => {
    const payload = createVibePayload({ content: textContent('  hello world  ') });
    assert.deepEqual(payload, validPayload);
    assert.equal(vibeAttachment.type, ATTACHMENT_TYPE);
  });

  it('returns null for blank text', () => {
    assert.equal(createVibePayload({ content: textContent('  \n ') }), null);
  });

  it('returns null for image input', () => {
    assert.equal(createVibePayload({ content: imageContent }), null);
  });

  it('returns null for malformed text input', () => {
    assert.equal(createVibePayload({ content: { kind: 'text', text: null } }), null);
  });

  it('rejects bad JSON and missing kind', () => {
    assert.equal(decodeVibePayload('not-json'), null);
    assert.equal(decodeVibePayload(JSON.stringify({ text: 'x', version: 1 })), null);
  });

  it('decodes structured V2 objects and serialized domain fixtures', () => {
    assert.deepEqual(decodeVibePayload(validPayload), validPayload);
    assert.deepEqual(decodeVibePayload(JSON.stringify(validPayload)), validPayload);
  });

  it('rejects null, missing version, invalid text and invalid character counts', () => {
    for (const value of [null, undefined, [], {}, { ...validPayload, version: undefined }, { ...validPayload, version: 2 },
      { ...validPayload, text: 10 }, { ...validPayload, charCount: -1 }, { ...validPayload, charCount: NaN }]) {
      assert.equal(decodeVibePayload(value), null);
    }
  });

  it('truncates text to 280 characters and preserves original length', () => {
    const payload = createVibePayload({ content: textContent('a'.repeat(400)) });
    assert.equal(payload.text.length, 280);
    assert.equal(payload.charCount, 400);
  });
});

describe('built V2 detector and fallback matching', () => {
  it('registers only declared detector functions with no renderer, actions or messages', async t => {
    const { registry } = await setupPlugin(t);
    assert.deepEqual(Object.keys(registry.detectors), manifest.detectors.map(entry => entry.id));
    assert.equal(typeof registry.detectors['vibe-detector'], 'function');
    assert.deepEqual(Object.keys(registry.actions), []);
    assert.deepEqual(Object.keys(registry.messages), []);
    assert.equal('attachmentRenderers' in registry, false);
  });

  it('writes the full declared attachment on copy and own-only recopy', async t => {
    const { registry, launch } = await setupPlugin(t);
    const writes = [];
    for (const trigger of ['copy', 'recopy']) {
      const host = fakeHost(launch);
      const item = itemSnapshot('text', { attachments: trigger === 'copy' ? [] : [ownReference] });
      const output = await registry.detectors['vibe-detector']({ item, content: textContent('hello world'), trigger }, host.ctx);
      assert.equal(output, undefined);
      assert.deepEqual(host.methods(), ['item.setAttachments']);
      const [write] = host.paramsOf('item.setAttachments');
      assert.equal(write.type, ATTACHMENT_TYPE);
      assert.ok(manifest.writes.attachmentTypes.includes(write.type));
      assert.deepEqual(write.entries, [{ key: 'primary', payload: validPayload }]);
      assert.ok(write.entries.length <= PLUGIN_WRITE_LIMITS.maximumAttachmentsPerItem);
      assert.ok(Buffer.byteLength(JSON.stringify(write.entries[0].payload)) <= PLUGIN_WRITE_LIMITS.maximumPayloadBytes);
      writes.push(host.calls);
    }
    assert.deepEqual(writes[0], writes[1]);
  });

  it('yields to foreign V2 refs, including when its own previous result is present', async t => {
    const { registry, launch } = await setupPlugin(t);
    for (const trigger of ['copy', 'recopy']) {
      for (const attachments of [[foreignReference], [foreignReference, ownReference]]) {
        const host = fakeHost(launch);
        await registry.detectors['vibe-detector']({ item: itemSnapshot('text', { attachments }), content: textContent('hello world'), trigger }, host.ctx);
        assert.deepEqual(host.calls, []);
      }
    }
  });

  it('writes again after the foreign attachment is removed', async t => {
    const { registry, launch } = await setupPlugin(t);
    const host = fakeHost(launch);
    await registry.detectors['vibe-detector']({ item: itemSnapshot('text'), content: textContent('hello world'), trigger: 'manual' }, host.ctx);
    assert.deepEqual(host.paramsOf('item.setAttachments')[0].entries, [{ key: 'primary', payload: validPayload }]);
  });

  it('does not write for blank text or image content', async t => {
    const { registry, launch } = await setupPlugin(t);
    for (const content of [textContent(''), textContent('  \n '), imageContent]) {
      const host = fakeHost(launch);
      await registry.detectors['vibe-detector']({ item: itemSnapshot(content.kind), content, trigger: 'edit' }, host.ctx);
      assert.deepEqual(host.calls, []);
    }
  });

  it('keeps multibyte samples within the payload budget', async t => {
    const { registry, launch } = await setupPlugin(t);
    const host = fakeHost(launch);
    await registry.detectors['vibe-detector']({ item: itemSnapshot('text'), content: textContent('字'.repeat(400)), trigger: 'copy' }, host.ctx);
    const payload = host.paramsOf('item.setAttachments')[0].entries[0].payload;
    assert.equal(payload.text.length, 280);
    assert.equal(payload.charCount, 400);
    assert.ok(Buffer.byteLength(JSON.stringify(payload)) <= PLUGIN_WRITE_LIMITS.maximumPayloadBytes);
  });
});
