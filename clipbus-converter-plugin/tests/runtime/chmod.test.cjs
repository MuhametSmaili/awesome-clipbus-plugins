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

test('manifest has chmod-detector', () => {
  const ids = manifest.detectors.map((d) => d.id);
  assert.ok(ids.includes('chmod-detector'), 'missing chmod-detector');
});

test('manifest has chmod-renderer', () => {
  const ids = manifest.renderers.map((r) => r.id);
  assert.ok(ids.includes('chmod-renderer'), 'missing chmod-renderer');
});

test('chmod-renderer page references renderers/ path', () => {
  const renderer = manifest.renderers.find((r) => r.id === 'chmod-renderer');
  assert.ok(renderer.page.startsWith('dist/ui/renderers/'), `unexpected page: ${renderer.page}`);
});



// ---------------------------------------------------------------------------
// parsePermissions — basic cases
// ---------------------------------------------------------------------------

test('parsePermissions: rwxr-xr-x → octal 755', () => {
  const { parsePermissions } = require(path.resolve(root, 'src/features/chmod-renderer/payload.ts'));
  const result = parsePermissions('rwxr-xr-x');
  assert.ok(result, 'should parse rwxr-xr-x');
  assert.equal(result.octal, '755');
});

test('parsePermissions: rwxr-xr-x → correct per-class booleans', () => {
  const { parsePermissions } = require(path.resolve(root, 'src/features/chmod-renderer/payload.ts'));
  const result = parsePermissions('rwxr-xr-x');
  const [owner, group, others] = result.classes;
  // Owner: rwx
  assert.equal(owner.read, true);
  assert.equal(owner.write, true);
  assert.equal(owner.execute, true);
  // Group: r-x
  assert.equal(group.read, true);
  assert.equal(group.write, false);
  assert.equal(group.execute, true);
  // Others: r-x
  assert.equal(others.read, true);
  assert.equal(others.write, false);
  assert.equal(others.execute, true);
});

test('parsePermissions: rw-r--r-- → octal 644', () => {
  const { parsePermissions } = require(path.resolve(root, 'src/features/chmod-renderer/payload.ts'));
  const result = parsePermissions('rw-r--r--');
  assert.ok(result, 'should parse rw-r--r--');
  assert.equal(result.octal, '644');
});

test('parsePermissions: rw-r--r-- → correct per-class booleans', () => {
  const { parsePermissions } = require(path.resolve(root, 'src/features/chmod-renderer/payload.ts'));
  const result = parsePermissions('rw-r--r--');
  const [owner, group, others] = result.classes;
  assert.equal(owner.read, true);
  assert.equal(owner.write, true);
  assert.equal(owner.execute, false);
  assert.equal(group.read, true);
  assert.equal(group.write, false);
  assert.equal(group.execute, false);
  assert.equal(others.read, true);
  assert.equal(others.write, false);
  assert.equal(others.execute, false);
});

// ---------------------------------------------------------------------------
// parsePermissions — special bits
// ---------------------------------------------------------------------------

test('parsePermissions: rwsr-xr-x → octal 4755 (setuid; owner execute true)', () => {
  const { parsePermissions } = require(path.resolve(root, 'src/features/chmod-renderer/payload.ts'));
  const result = parsePermissions('rwsr-xr-x');
  assert.ok(result, 'should parse rwsr-xr-x');
  assert.equal(result.octal, '4755');
  assert.equal(result.setuid, true);
  assert.equal(result.setgid, false);
  assert.equal(result.sticky, false);
  // setuid via 's' → execute is still true
  assert.equal(result.classes[0].execute, true);
});

test('parsePermissions: rwxr-xr-T → octal 1754 (sticky; others execute false)', () => {
  const { parsePermissions } = require(path.resolve(root, 'src/features/chmod-renderer/payload.ts'));
  const result = parsePermissions('rwxr-xr-T');
  assert.ok(result, 'should parse rwxr-xr-T');
  assert.equal(result.octal, '1754');
  assert.equal(result.sticky, true);
  assert.equal(result.setuid, false);
  assert.equal(result.setgid, false);
  // T = sticky WITHOUT execute
  assert.equal(result.classes[2].execute, false);
});

test('parsePermissions: rwSr-xr-x → octal 4655 (setuid without owner execute)', () => {
  const { parsePermissions } = require(path.resolve(root, 'src/features/chmod-renderer/payload.ts'));
  const result = parsePermissions('rwSr-xr-x');
  assert.ok(result, 'should parse rwSr-xr-x');
  assert.equal(result.octal, '4655');
  assert.equal(result.setuid, true);
  // S = setuid WITHOUT execute
  assert.equal(result.classes[0].execute, false);
});

// ---------------------------------------------------------------------------
// parsePermissions — leading type char
// ---------------------------------------------------------------------------

test('parsePermissions: -rwxr-xr-x → octal 755 + fileType "file"', () => {
  const { parsePermissions } = require(path.resolve(root, 'src/features/chmod-renderer/payload.ts'));
  const result = parsePermissions('-rwxr-xr-x');
  assert.ok(result, 'should parse -rwxr-xr-x');
  assert.equal(result.octal, '755');
  assert.equal(result.fileType, 'file');
});

test('parsePermissions: drwxr-xr-x → fileType "directory"', () => {
  const { parsePermissions } = require(path.resolve(root, 'src/features/chmod-renderer/payload.ts'));
  const result = parsePermissions('drwxr-xr-x');
  assert.ok(result, 'should parse drwxr-xr-x');
  assert.equal(result.octal, '755');
  assert.equal(result.fileType, 'directory');
});

test('parsePermissions: lrwxrwxrwx → fileType "symlink"', () => {
  const { parsePermissions } = require(path.resolve(root, 'src/features/chmod-renderer/payload.ts'));
  const result = parsePermissions('lrwxrwxrwx');
  assert.ok(result, 'should parse lrwxrwxrwx');
  assert.equal(result.fileType, 'symlink');
});

// ---------------------------------------------------------------------------
// parsePermissions — null cases (no false positives)
// ---------------------------------------------------------------------------

test('parsePermissions: bare 755 → null (no radix collision)', () => {
  const { parsePermissions } = require(path.resolve(root, 'src/features/chmod-renderer/payload.ts'));
  assert.equal(parsePermissions('755'), null, 'bare octal must not match');
});

test('parsePermissions: prose text → null', () => {
  const { parsePermissions } = require(path.resolve(root, 'src/features/chmod-renderer/payload.ts'));
  assert.equal(parsePermissions('hello world'), null);
  assert.equal(parsePermissions(''), null);
  assert.equal(parsePermissions('rwxr-x'), null);         // too short
  assert.equal(parsePermissions('rwxr-xr-xr-x'), null);  // too long
  assert.equal(parsePermissions('rwxr-xr-X'), null);      // invalid char at pos 8
});

// ---------------------------------------------------------------------------
// createChmodPayload
// ---------------------------------------------------------------------------

test('createChmodPayload returns correct attachmentType', () => {
  const { createChmodPayload } = require(path.resolve(root, 'src/features/chmod-renderer/payload.ts'));
  const input = { item: sampleItem, content: { kind: 'text', text: 'rwxr-xr-x' }, attachments: [] };
  const artifact = createChmodPayload(input);
  assert.ok(artifact, 'artifact should not be null');
});

test('createChmodPayload payload kind is chmod_preview', () => {
  const { createChmodPayload } = require(path.resolve(root, 'src/features/chmod-renderer/payload.ts'));
  const input = { item: sampleItem, content: { kind: 'text', text: 'rwxr-xr-x' }, attachments: [] };
  const artifact = createChmodPayload(input);
  const payload = artifact;
  assert.equal(payload.kind, 'chmod_preview');
  assert.equal(payload.octal, '755');
});

test('createChmodPayload returns null for bare octal', () => {
  const { createChmodPayload } = require(path.resolve(root, 'src/features/chmod-renderer/payload.ts'));
  const input = { item: sampleItem, content: { kind: 'text', text: '755' }, attachments: [] };
  const artifact = createChmodPayload(input);
  assert.equal(artifact, null, 'bare octal must not produce chmod artifact');
});

// ---------------------------------------------------------------------------
// decodeChmodPayload
// ---------------------------------------------------------------------------

test('decodeChmodPayload returns null for invalid inputs', () => {
  const { decodeChmodPayload } = require(path.resolve(root, 'src/features/chmod-renderer/payload.ts'));
  assert.equal(decodeChmodPayload('not-json'), null);
  assert.equal(decodeChmodPayload('{"kind":"other"}'), null);
  assert.equal(decodeChmodPayload(null), null);
  assert.equal(decodeChmodPayload(undefined), null);
});

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
