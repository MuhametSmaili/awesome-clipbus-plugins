"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const { attachment } = require(path.join(root, "src/features/xml-renderer/payload.ts"));
const manifest = JSON.parse(fs.readFileSync(path.resolve(root, "manifest.json"), "utf8"));

const sampleItem = { id: "item-1", kind: "text", tags: [], sourceApp: "com.example.app" };

function textInput(text) {
  return { item: sampleItem, content: { kind: "text", text }, attachments: [] };
}

// ── Manifest contract ─────────────────────────────────────────────────────────

test("manifest declares xml-detector / xml-renderer", () => {
  assert.ok(manifest.detectors.map((d) => d.id).includes("xml-detector"));
  assert.ok(manifest.renderers.map((r) => r.id).includes("xml-renderer"));
});

test("xml-renderer page references renderers/ path", () => {
  const r = manifest.renderers.find((x) => x.id === "xml-renderer");
  assert.ok(r.page.startsWith("dist/ui/renderers/"), `unexpected page: ${r.page}`);
});

// ── Detector / payload ────────────────────────────────────────────────────────

test("detect <a><b>1</b></a> → elementCount 2, formatted contains newline+indent", () => {
  const { createXmlPayload } = require(path.resolve(root, "src/features/xml-renderer/payload.ts"));
  const payload = createXmlPayload(textInput("<a><b>1</b></a>"));
  assert.ok(payload, "should detect XML");
  assert.equal(attachment.type, "plugin.formatter.xml");
  const p = payload;
  assert.equal(p.kind, "xml_preview");
  assert.equal(p.elementCount, 2);
  assert.ok(p.formatted.includes("\n"), "formatted should contain a newline");
  assert.ok(p.formatted.includes("  "), "formatted should contain indentation");
});

test("detect <root attr=\"x\"><child/></root> → attributeCount ≥ 1", () => {
  const { createXmlPayload } = require(path.resolve(root, "src/features/xml-renderer/payload.ts"));
  const payload = createXmlPayload(textInput('<root attr="x"><child/></root>'));
  assert.ok(payload, "should detect XML");
  const p = payload;
  assert.ok(p.attributeCount >= 1, `expected attributeCount ≥ 1, got ${p.attributeCount}`);
});

test("detect multi-attribute tag counts all attributes", () => {
  const { createXmlPayload } = require(path.resolve(root, "src/features/xml-renderer/payload.ts"));
  const p = createXmlPayload(textInput('<node a="1" b="2"><leaf/></node>'));
  assert.ok(p, "should detect XML");
  assert.ok(p.attributeCount >= 2, `expected attributeCount ≥ 2, got ${p.attributeCount}`);
});

test("detect XML with prolog declaration", () => {
  const { createXmlPayload } = require(path.resolve(root, "src/features/xml-renderer/payload.ts"));
  const payload = createXmlPayload(textInput('<?xml version="1.0"?><root><child/></root>'));
  assert.ok(payload, "should detect XML with prolog");
  const p = payload;
  assert.ok(p.formatted.includes("<?xml"), "formatted should include prolog");
});

test("detect XML with comment", () => {
  const { createXmlPayload } = require(path.resolve(root, "src/features/xml-renderer/payload.ts"));
  const payload = createXmlPayload(textInput("<!-- header --><root><item/></root>"));
  assert.ok(payload, "should detect XML with comment");
  const p = payload;
  assert.ok(p.formatted.includes("<!-- header -->"), "formatted should retain comment");
});

test("ignore plain text 'hello'", () => {
  const { createXmlPayload } = require(path.resolve(root, "src/features/xml-renderer/payload.ts"));
  assert.equal(createXmlPayload(textInput("hello")), null);
});

test("ignore JSON {\"a\":1}", () => {
  const { createXmlPayload } = require(path.resolve(root, "src/features/xml-renderer/payload.ts"));
  assert.equal(createXmlPayload(textInput('{"a":1}')), null);
});

test("ignore single bare < character", () => {
  const { createXmlPayload } = require(path.resolve(root, "src/features/xml-renderer/payload.ts"));
  assert.equal(createXmlPayload(textInput("<")), null);
});

test("ignore single self-closing tag with no partner", () => {
  const { createXmlPayload } = require(path.resolve(root, "src/features/xml-renderer/payload.ts"));
  assert.equal(createXmlPayload(textInput("<br/>")), null);
});

test("ignore image content kind", () => {
  const { createXmlPayload } = require(path.resolve(root, "src/features/xml-renderer/payload.ts"));
  const payload = createXmlPayload({
    item: sampleItem,
    content: { kind: "image", width: 10, height: 10, format: "png", bytes: 0 },
  });
  assert.equal(payload, null);
});

test("decodeXmlPayload returns null for bad JSON", () => {
  const { decodeXmlPayload } = require(path.resolve(root, "src/features/xml-renderer/payload.ts"));
  assert.equal(decodeXmlPayload("not-json"), null);
  assert.equal(decodeXmlPayload('{"kind":"other"}'), null);
  assert.equal(decodeXmlPayload(null), null);
  assert.equal(decodeXmlPayload(undefined), null);
});

test("decodeXmlPayload accepts a structured V2 attachment payload", () => {
  const { createXmlPayload, decodeXmlPayload } = require(path.resolve(root, "src/features/xml-renderer/payload.ts"));
  const payload = createXmlPayload(textInput("<a><b>1</b></a>"));
  assert.deepEqual(decodeXmlPayload(payload), payload);
});
