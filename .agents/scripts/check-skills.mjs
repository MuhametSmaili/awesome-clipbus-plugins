import assert from "node:assert/strict";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function files(dir, prefix = "") {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if ([".DS_Store", ".omc", "__pycache__", "node_modules"].includes(entry.name)) continue;
    assert.ok(!entry.isSymbolicLink(), `${dir}/${entry.name} must be a real copy`);
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...await files(path.join(dir, entry.name), relative));
    else result.push(relative);
  }
  return result.sort();
}

const source = path.join(root, ".agents/skills");
assert.ok((await lstat(source)).isDirectory(), ".agents/skills must be a real directory");
const expected = await files(source);
assert.ok(expected.length > 0, "Skill files must exist");
for (const client of [".codex", ".claude"]) {
  const target = path.join(root, client, "skills");
  assert.ok((await lstat(target)).isDirectory(), `${client}/skills must be a real directory`);
  assert.deepEqual(await files(target), expected, `${client}: skill file list differs`);
  for (const file of expected) {
    assert.ok((await readFile(path.join(source, file))).equals(await readFile(path.join(target, file))), `${client}/skills/${file} differs`);
  }
}
console.log(`All three skill directories match (${expected.length} files each).`);
