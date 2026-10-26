"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const manifest = JSON.parse(fs.readFileSync(path.resolve(root, "manifest.json"), "utf8"));
const payload = require(path.resolve(root, "src/features/case-tool/payload.ts"));

const expected = {
  uppercase: "HELLO WORLD",
  lowercase: "hello world",
  camelCase: "helloWorld",
  pascalCase: "HelloWorld",
  snakeCase: "hello_world",
  kebabCase: "hello-world",
  constantCase: "HELLO_WORLD",
  titleCase: "Hello World",
  sentenceCase: "Hello world",
  dotCase: "hello.world",
};

test("manifest exposes ten independent auto-run case actions", () => {
  const actions = Object.fromEntries((manifest.actions ?? []).map((action) => [action.id, action]));
  assert.deepEqual(Object.keys(actions), Object.keys(expected));
  for (const action of Object.values(actions)) {
    assert.equal(action.lifecycle, undefined);
    assert.equal(action.page, undefined);
    assert.deepEqual(action.inputKinds, ["text"]);
  }
});

test("case action handlers transform the current cascade content", async () => {
  const { caseActions } = require(path.resolve(root, "src/features/case-tool/action.ts"));
  assert.deepEqual(Object.keys(caseActions), Object.keys(expected));
  for (const [id, output] of Object.entries(expected)) {
    const result = await caseActions[id]({
      content: { kind: "text", text: "Hello world" },
    });
    assert.equal(result.result.kind, "text", id);
    assert.equal(result.result.text, output, id);
  }
});

test("case actions ignore non-text current cascade content", async () => {
  const { caseActions } = require(path.resolve(root, "src/features/case-tool/action.ts"));
  const result = await caseActions.camelCase({ content: { kind: "image" } });
  assert.equal(result.result.kind, "none");
});

test("word splitting handles camel case and acronym boundaries", () => {
  assert.deepEqual(payload.splitWords("XMLParser helloWorld foo_bar-baz"), [
    "xml",
    "parser",
    "hello",
    "world",
    "foo",
    "bar",
    "baz",
  ]);
});

test("pure transforms cover every naming convention", () => {
  const input = "helloWorld foo_bar-baz";
  assert.equal(payload.toCamel(input), "helloWorldFooBarBaz");
  assert.equal(payload.toPascal(input), "HelloWorldFooBarBaz");
  assert.equal(payload.toSnake(input), "hello_world_foo_bar_baz");
  assert.equal(payload.toKebab(input), "hello-world-foo-bar-baz");
  assert.equal(payload.toConstant(input), "HELLO_WORLD_FOO_BAR_BAZ");
  assert.equal(payload.toTitle(input), "Hello World Foo Bar Baz");
  assert.equal(payload.toSentence(input), "Hello world foo bar baz");
  assert.equal(payload.toDot(input), "hello.world.foo.bar.baz");
});
