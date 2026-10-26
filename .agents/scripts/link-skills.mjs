// Run after cloning or moving the repository. Keep skills in .agents only;
// client-specific discovery paths are local directory links, never copies.
import { lstat, mkdir, realpath, stat, symlink, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = path.join(root, ".agents", "skills");

async function main() {
  if (!(await stat(source)).isDirectory()) throw new Error(`${source} must be a directory`);
  const canonical = await realpath(source);

  for (const client of [".claude", ".codex"]) {
    const link = path.join(root, client, "skills");
    const entry = await lstat(link).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });

    if (entry?.isSymbolicLink()) {
      const current = await realpath(link).catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      if (current === canonical) {
        console.log(`${client}/skills already points to .agents/skills`);
        continue;
      }
      await unlink(link); // Remove only the link, including stale Windows junctions.
    } else if (entry !== null) {
      throw new Error(`Refusing to replace ${client}/skills: move its contents into .agents/skills first`);
    }

    await mkdir(path.dirname(link), { recursive: true });
    const windows = process.platform === "win32";
    await symlink(windows ? source : path.relative(path.dirname(link), source), link, windows ? "junction" : "dir");
    console.log(`${client}/skills -> .agents/skills (${windows ? "junction" : "symlink"})`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
