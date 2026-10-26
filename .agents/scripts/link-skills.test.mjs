import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readlink, realpath, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./link-skills.mjs", import.meta.url));

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "clipbus skills links "));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, ".agents/scripts"), { recursive: true });
  await mkdir(path.join(root, ".agents/skills/example"), { recursive: true });
  await copyFile(script, path.join(root, ".agents/scripts/link-skills.mjs"));
  await writeFile(path.join(root, ".agents/skills/example/SKILL.md"), "canonical\n");
  const run = () => spawnSync(process.execPath, [path.join(root, ".agents/scripts/link-skills.mjs")], { cwd: os.tmpdir(), encoding: "utf8" });
  return { root, run };
}

test("both clients share the canonical files and repeated setup keeps links intact", async (t) => {
  const { root, run } = await fixture(t);
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  const targets = [];
  for (const client of [".claude", ".codex"]) {
    const link = path.join(root, client, "skills");
    assert.ok((await lstat(link)).isSymbolicLink());
    assert.equal(await realpath(link), await realpath(path.join(root, ".agents/skills")));
    targets.push(await readlink(link));
  }
  await writeFile(path.join(root, ".claude/skills/example/SKILL.md"), "edited through Claude\n");
  assert.equal(await readFile(path.join(root, ".codex/skills/example/SKILL.md"), "utf8"), "edited through Claude\n");
  assert.equal(await readFile(path.join(root, ".agents/skills/example/SKILL.md"), "utf8"), "edited through Claude\n");
  result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await Promise.all([".claude", ".codex"].map(client => readlink(path.join(root, client, "skills")))), targets);

  // No tracked symlink/placeholder is needed: this also works with core.symlinks=false.
  await writeFile(path.join(root, ".gitignore"), "/.claude/skills\n/.codex/skills\n");
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "core.symlinks", "false"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n");
  assert.ok(tracked.includes(".agents/skills/example/SKILL.md"));
  assert.ok(!tracked.some(file => file.startsWith(".claude/") || file.startsWith(".codex/")));
});

test("setup preserves real client directories instead of deleting their skills", async (t) => {
  const { root, run } = await fixture(t);
  const custom = path.join(root, ".claude/skills/custom/SKILL.md");
  await mkdir(path.dirname(custom), { recursive: true });
  await writeFile(custom, "keep me\n");
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to replace/);
  assert.equal(await readFile(custom, "utf8"), "keep me\n");
});

test("setup retargets stale links without changing the old target", async (t) => {
  const { root, run } = await fixture(t);
  assert.equal(run().status, 0);
  const other = path.join(root, "previous skills");
  await mkdir(other);
  await writeFile(path.join(other, "keep.txt"), "keep\n");
  const link = path.join(root, ".claude/skills");
  await unlink(link);
  await symlink(other, link, process.platform === "win32" ? "junction" : "dir");
  assert.equal(run().status, 0);
  assert.equal(await realpath(link), await realpath(path.join(root, ".agents/skills")));
  assert.equal(await readFile(path.join(other, "keep.txt"), "utf8"), "keep\n");
});
