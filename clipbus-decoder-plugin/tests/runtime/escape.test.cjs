"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const manifest = JSON.parse(fs.readFileSync(path.resolve(root, "manifest.json"), "utf8"));
const transforms = require(path.resolve(root, "src/features/escape-tool/payload.ts"));

const { setupPlugin, fakeHost, itemSnapshot, imageContent } = require("../support/plugin.cjs");

const actionIDs = [
  "url-encode",
  "url-decode",
  "html-encode",
  "html-decode",
  "base64-encode",
  "base64-decode",
  "unicode-escape",
  "unicode-unescape",
  "json-escape",
  "json-unescape",
];

test("manifest exposes ten independent transformations", () => {
  assert.deepEqual((manifest.actions ?? []).map((action) => action.id), actionIDs);
  for (const action of manifest.actions) {
    assert.equal(action.lifecycle, undefined);
    assert.equal(action.page, undefined);
    assert.deepEqual(action.inputKinds, ["text"]);
  }
});

test("actions transform current cascade content", async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const escapeActions = registry.actions;
  assert.deepEqual(Object.keys(escapeActions), actionIDs);

  const encoded = await escapeActions["url-encode"]({
    item: itemSnapshot("text"),
    content: { kind: "text", text: "a b&c" },
  }, host.ctx);
  assert.equal(encoded.result.kind, "text");
  assert.equal(encoded.result.text, "a%20b%26c");

  const decoded = await escapeActions["url-decode"]({
    item: itemSnapshot("text"),
    content: { kind: "text", text: encoded.result.text },
  }, host.ctx);
  assert.equal(decoded.result.text, "a b&c");
});

test("decode actions reject malformed input without producing placeholder text", async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const escapeActions = registry.actions;
  const badUrl = await escapeActions["url-decode"]({
    item: itemSnapshot("text"),
    content: { kind: "text", text: "%ZZ" },
  }, host.ctx);
  const badBase64 = await escapeActions["base64-decode"]({
    item: itemSnapshot("text"),
    content: { kind: "text", text: "%%%" },
  }, host.ctx);
  assert.equal(badUrl.result.kind, "none");
  assert.equal(badBase64.result.kind, "none");
});

test("actions ignore non-text current cascade content", async t => {
  const { registry, launch } = await setupPlugin(t);
  const host = fakeHost(launch);
  const escapeActions = registry.actions;
  const result = await escapeActions["html-encode"]({ item: itemSnapshot("image"), content: imageContent }, host.ctx);
  assert.equal(result.result.kind, "none");
});

test("URL encode and decode round-trip", () => {
  const original = "a b&c=1+2";
  assert.equal(transforms.urlDecode(transforms.urlEncode(original)), original);
});

test("HTML encode and decode round-trip", () => {
  const original = '<script>alert("XSS & more")</script>';
  assert.equal(transforms.htmlDecode(transforms.htmlEncode(original)), original);
});

test("Base64 round-trip preserves UTF-8 text", () => {
  for (const original of ["hello world", "你好"]) {
    assert.equal(transforms.base64Decode(transforms.base64Encode(original)), original);
  }
});

test("Unicode escape and unescape round-trip", () => {
  const original = "Hello 👋";
  assert.equal(transforms.unicodeDecode(transforms.unicodeEncode(original)), original);
});

test("JSON escape and unescape round-trip", () => {
  const original = 'say "hello" and \\backslash';
  assert.equal(transforms.jsonDecode(transforms.jsonEncode(original)), original);
});
