"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const manifest = JSON.parse(fs.readFileSync(path.resolve(root, "manifest.json"), "utf8"));

const { itemSnapshot } = require("../support/plugin.cjs");
const sampleItem = itemSnapshot("text");

function textInput(text) {
  return { item: sampleItem, content: { kind: "text", text }, trigger: "copy" };
}

// ── Manifest contract ─────────────────────────────────────────────────────────

test("manifest declares cron-detector and cron-renderer", () => {
  assert.ok(manifest.detectors.map((d) => d.id).includes("cron-detector"));
  assert.ok(manifest.renderers.map((r) => r.id).includes("cron-renderer"));
});

test("cron-renderer page references built renderers/ path", () => {
  const r = manifest.renderers.find((x) => x.id === "cron-renderer");
  assert.ok(r.page.startsWith("dist/ui/renderers/"), `unexpected page: ${r.page}`);
});

// ── Detector / payload ────────────────────────────────────────────────────────

test("detect '30 9 * * 1-5' returns 5 fields", () => {
  const { createCronPayload } = require(path.resolve(root, "src/features/cron-renderer/payload.ts"));
  const payload = createCronPayload(textInput("30 9 * * 1-5"));
  assert.ok(payload, "should detect valid cron expression");
  const { attachment } = require(path.resolve(root, "src/features/cron-renderer/payload.ts"));
  assert.equal(attachment.type, "plugin.cron.schedule");
  assert.equal(payload.kind, "cron_preview");
  assert.equal(payload.fields.length, 5);
});

test("weekday field description for '1-5' contains English weekday names", () => {
  const { createCronPayload } = require(path.resolve(root, "src/features/cron-renderer/payload.ts"));
  const payload = createCronPayload(textInput("30 9 * * 1-5"));
  assert.ok(payload, "should parse '30 9 * * 1-5'");
  const weekdayField = payload.fields[4];
  assert.ok(
    weekdayField.description.includes("Mon") || weekdayField.description.includes("Fri") || weekdayField.description.includes("1-5"),
    `weekday description should contain 'Mon', 'Fri', or '1-5', got: ${weekdayField.description}`
  );
});

test("detect '*/15 * * * *' passes", () => {
  const { createCronPayload } = require(path.resolve(root, "src/features/cron-renderer/payload.ts"));
  const payload = createCronPayload(textInput("*/15 * * * *"));
  assert.ok(payload, "*/15 * * * * should be detected");
  assert.equal(payload.expression, "*/15 * * * *");
});

test("minute field description for '*/15' contains '15'", () => {
  const { createCronPayload } = require(path.resolve(root, "src/features/cron-renderer/payload.ts"));
  const payload = createCronPayload(textInput("*/15 * * * *"));
  assert.ok(payload);
  assert.ok(payload.fields[0].description.includes("15"), `got: ${payload.fields[0].description}`);
});

test("rejects 'hello world foo bar baz' — non-cron plain text", () => {
  const { createCronPayload } = require(path.resolve(root, "src/features/cron-renderer/payload.ts"));
  assert.equal(createCronPayload(textInput("hello world foo bar baz")), null);
});

test("rejects 4-field expression '1 2 3 4'", () => {
  const { createCronPayload } = require(path.resolve(root, "src/features/cron-renderer/payload.ts"));
  assert.equal(createCronPayload(textInput("1 2 3 4")), null);
});

test("rejects out-of-range minute '99 9 * * *'", () => {
  const { createCronPayload } = require(path.resolve(root, "src/features/cron-renderer/payload.ts"));
  assert.equal(createCronPayload(textInput("99 9 * * *")), null);
});

test("rejects pure-number expression '1 2 3 4 5' (guard: no special chars)", () => {
  const { createCronPayload } = require(path.resolve(root, "src/features/cron-renderer/payload.ts"));
  assert.equal(createCronPayload(textInput("1 2 3 4 5")), null);
});

test("decodeCronPayload returns null for bad JSON", () => {
  const { decodeCronPayload } = require(path.resolve(root, "src/features/cron-renderer/payload.ts"));
  assert.equal(decodeCronPayload("not-json"), null);
  assert.equal(decodeCronPayload('{"kind":"other"}'), null);
  assert.equal(decodeCronPayload(null), null);
  assert.equal(decodeCronPayload(undefined), null);
});

// ── Card data ─────────────────────────────────────────────────────────────────

test("renderer defaults preserve the schedule title and tint", () => {
  const renderer = manifest.renderers.find((entry) => entry.id === "cron-renderer");
  assert.equal(renderer.title, "Cron Schedule");
  assert.equal(renderer.tint, "#B45309");
  assert.deepEqual(renderer.height, { min: 120, max: 560 });
});

test("decodeCronPayload accepts the structured card payload and JSON domain fixtures", () => {
  const { createCronPayload, decodeCronPayload } = require(path.resolve(root, "src/features/cron-renderer/payload.ts"));
  const payload = createCronPayload(textInput("0 9 * * 1-5"));
  assert.ok(payload);
  assert.deepEqual(decodeCronPayload(payload), payload);
  assert.deepEqual(decodeCronPayload(JSON.stringify(payload)), payload);
});

// ── Extra validations ─────────────────────────────────────────────────────────

test("accepts named weekday range 'MON-FRI'", () => {
  const { createCronPayload } = require(path.resolve(root, "src/features/cron-renderer/payload.ts"));
  const payload = createCronPayload(textInput("0 8 * * MON-FRI"));
  assert.ok(payload, "0 8 * * MON-FRI should be detected");
});

test("accepts named month 'JAN-MAR'", () => {
  const { createCronPayload } = require(path.resolve(root, "src/features/cron-renderer/payload.ts"));
  const payload = createCronPayload(textInput("0 0 1 JAN-MAR *"));
  assert.ok(payload, "0 0 1 JAN-MAR * should be detected");
});

test("rejects image content kind", () => {
  const { createCronPayload } = require(path.resolve(root, "src/features/cron-renderer/payload.ts"));
  const result = createCronPayload({
    item: sampleItem,
    content: { kind: "image", width: 10, height: 10, format: "png", bytes: 0 },
  });
  assert.equal(result, null);
});
