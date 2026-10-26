"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const manifest = JSON.parse(fs.readFileSync(path.resolve(root, "manifest.json"), "utf8"));

const sampleItem = { id: "item-1", kind: "text", tags: [], sourceApp: "com.example.app" };

// Canonical jwt.io HS256 example: header {alg:HS256,typ:JWT}, payload {sub,name,iat}.
const CANONICAL =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
  ".eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ" +
  ".SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}
function makeJwt(header, payload, sig = "sig") {
  return `${b64url(header)}.${b64url(payload)}.${sig}`;
}
function textInput(text) {
  return { item: sampleItem, content: { kind: "text", text }, attachments: [] };
}

// ── Manifest contract ─────────────────────────────────────────────────────────

test("manifest declares jwt-detector / jwt-renderer", () => {
  assert.ok(manifest.detectors.map((d) => d.id).includes("jwt-detector"));
  assert.ok(manifest.renderers.map((r) => r.id).includes("jwt-renderer"));
});

test("jwt-renderer page references renderers/ path", () => {
  const r = manifest.renderers.find((x) => x.id === "jwt-renderer");
  assert.ok(r.page.startsWith("dist/ui/renderers/"), `unexpected page: ${r.page}`);
});

// ── Detector / payload ────────────────────────────────────────────────────────

test("detector decodes the canonical JWT header and claims", () => {
  const { createJwtPayload } = require(path.resolve(root, "src/features/jwt-renderer/payload.ts"));
  const artifact = createJwtPayload(textInput(CANONICAL));
  assert.ok(artifact, "should detect canonical JWT");

  const payload = artifact;
  assert.equal(payload.kind, "jwt_preview");
  assert.equal(payload.alg, "HS256");
  assert.equal(payload.typ, "JWT");
  const claims = JSON.parse(payload.payloadPretty);
  assert.equal(claims.sub, "1234567890");
  assert.equal(claims.name, "John Doe");
});

test("claimFacts surface standard string claims", () => {
  const { createJwtPayload } = require(path.resolve(root, "src/features/jwt-renderer/payload.ts"));
  const payload = createJwtPayload(textInput(CANONICAL));
  const labels = payload.claimFacts.map((f) => f.label);
  assert.ok(labels.some((l) => l.includes("sub")), "expected a sub claim fact");
  assert.ok(labels.includes("name"), "expected a name claim fact");
});

test("exp far in the past is reported as expired", () => {
  const { createJwtPayload } = require(path.resolve(root, "src/features/jwt-renderer/payload.ts"));
  const jwt = makeJwt({ alg: "HS256", typ: "JWT" }, { sub: "x", exp: 1000000000 });
  const payload = createJwtPayload(textInput(jwt));
  assert.equal(payload.isExpired, true);
});

test("exp far in the future is reported as not expired", () => {
  const { createJwtPayload } = require(path.resolve(root, "src/features/jwt-renderer/payload.ts"));
  const jwt = makeJwt({ alg: "HS256", typ: "JWT" }, { sub: "x", exp: 4000000000 });
  const payload = createJwtPayload(textInput(jwt));
  assert.equal(payload.isExpired, false);
});

test("detector rejects a header without alg", () => {
  const { createJwtPayload } = require(path.resolve(root, "src/features/jwt-renderer/payload.ts"));
  const jwt = makeJwt({ foo: 1 }, { bar: 2 });
  assert.equal(createJwtPayload(textInput(jwt)), null);
});

test("detector ignores plain text and non-JWT dotted strings", () => {
  const { createJwtPayload } = require(path.resolve(root, "src/features/jwt-renderer/payload.ts"));
  assert.equal(createJwtPayload(textInput("hello world this is prose")), null);
  assert.equal(createJwtPayload(textInput("not.a.token")), null);
  assert.equal(createJwtPayload(textInput("abcd.efgh.ijkl")), null);
});

test("detector ignores image content kind", () => {
  const { createJwtPayload } = require(path.resolve(root, "src/features/jwt-renderer/payload.ts"));
  const artifact = createJwtPayload({
    item: sampleItem,
    content: { kind: "image", width: 10, height: 10, format: "png", bytes: 0 },
    attachments: [],
  });
  assert.equal(artifact, null);
});

test("decodeJwtPayload returns null for non-jwt-preview payloads", () => {
  const { decodeJwtPayload } = require(path.resolve(root, "src/features/jwt-renderer/payload.ts"));
  assert.equal(decodeJwtPayload("not-json"), null);
  assert.equal(decodeJwtPayload('{"kind":"other"}'), null);
  assert.equal(decodeJwtPayload(null), null);
  assert.equal(decodeJwtPayload(undefined), null);
});

// ── Renderer ──────────────────────────────────────────────────────────────────


test('decodeJwtPayload accepts structured V2 attachment payloads', () => {
  const { createJwtPayload, decodeJwtPayload } = require(path.resolve(root, 'src/features/jwt-renderer/payload.ts'));
  const payload = createJwtPayload({ content: { kind: 'text', text: CANONICAL } });
  assert.ok(payload);
  assert.deepEqual(decodeJwtPayload(payload), payload);
  assert.deepEqual(decodeJwtPayload(JSON.stringify(payload)), payload);
});
