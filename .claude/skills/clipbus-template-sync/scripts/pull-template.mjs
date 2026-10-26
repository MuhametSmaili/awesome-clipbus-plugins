/**
 * pull-template.mjs — Pull the latest upstream clipbus-template-plugin into the
 * local template-plugin/ directory, then report the exact delta.
 *
 * How it works: it replaces template-plugin/'s git-TRACKED files with upstream's
 * tracked files. Because it only ever touches tracked files, local gitignored
 * content (node_modules/, dist/, .omc/, .DS_Store) is preserved automatically —
 * those are never tracked, so they are never deleted or overwritten.
 *
 * After it runs, the template delta is visible two ways:
 *   - the printed summary lists added / removed / modified paths (machine-readable
 *     with --json), so nothing is missed (untracked-added files don't show in
 *     `git diff`); and
 *   - `git diff template-plugin/` shows the content-level hunks for modified +
 *     deleted files. Read the added files directly.
 *
 * It does NOT `git add` or commit — it leaves the changes in the working tree so
 * the sync workflow can review the diff and decide what to propagate.
 *
 * Usage:
 *   node pull-template.mjs [repoRoot] [--ref <branch|tag|sha>] [--upstream <url>] [--json] [--dry-run]
 *     repoRoot    collection repo root (default: process.cwd())
 *     --ref       upstream ref to pull (default: the remote's default branch)
 *     --upstream  upstream git URL (default: scubers/clipbus-template-plugin)
 *     --json      also print a JSON delta block to stdout (between markers)
 *     --dry-run   compute and print the delta but do NOT modify the working tree
 *                 (useful to preview whether a sync is even needed)
 *
 * stdout: human-readable summary (+ JSON when --json). stderr: diagnostics.
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DEFAULT_UPSTREAM = "https://github.com/scubers/clipbus-template-plugin";
const TEMPLATE_DIR = "template-plugin";

function parseArgs(argv) {
  const opts = { repoRoot: null, ref: null, upstream: DEFAULT_UPSTREAM, json: false, dryRun: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--ref") opts.ref = argv[++i];
    else if (a === "--upstream") opts.upstream = argv[++i];
    else if (a === "--json") opts.json = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else positional.push(a);
  }
  opts.repoRoot = path.resolve(positional[0] ?? process.cwd());
  return opts;
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** List git-tracked files under a directory, returned as paths relative to it. */
function trackedFiles(repoRoot, subdir) {
  const out = git(repoRoot, ["ls-files", "-z", subdir ?? "."]);
  const prefix = subdir ? subdir.replace(/\/?$/, "/") : "";
  return out
    .split("\0")
    .filter(Boolean)
    .map((p) => (prefix && p.startsWith(prefix) ? p.slice(prefix.length) : p));
}

function sameContent(a, b) {
  try {
    return readFileSync(a).equals(readFileSync(b));
  } catch {
    return false;
  }
}

function copyInto(srcFile, destFile) {
  mkdirSync(path.dirname(destFile), { recursive: true });
  copyFileSync(srcFile, destFile);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const templateAbs = path.join(opts.repoRoot, TEMPLATE_DIR);

  if (!existsSync(templateAbs) || !statSync(templateAbs).isDirectory()) {
    process.stderr.write(
      `pull-template: "${TEMPLATE_DIR}/" not found under ${opts.repoRoot}. ` +
        `Run this from the Clipbus plugin collection root.\n`
    );
    process.exit(1);
  }
  try {
    git(opts.repoRoot, ["rev-parse", "--is-inside-work-tree"]);
  } catch {
    process.stderr.write(`pull-template: ${opts.repoRoot} is not a git work tree.\n`);
    process.exit(1);
  }

  const tmp = mkdtempSync(path.join(tmpdir(), "clipbus-upstream-"));
  try {
    process.stderr.write(`pull-template: cloning ${opts.upstream}${opts.ref ? ` @ ${opts.ref}` : ""} ...\n`);
    if (opts.ref) {
      // Arbitrary ref (branch/tag/sha): full clone then checkout is the robust path.
      git(process.cwd(), ["clone", "--quiet", opts.upstream, tmp]);
      git(tmp, ["checkout", "--quiet", opts.ref]);
    } else {
      git(process.cwd(), ["clone", "--quiet", "--depth", "1", opts.upstream, tmp]);
    }

    const upstreamHead = git(tmp, ["rev-parse", "HEAD"]).trim();
    const upstreamList = trackedFiles(tmp, null);
    const localList = trackedFiles(opts.repoRoot, TEMPLATE_DIR);

    const upstreamSet = new Set(upstreamList);
    const localSet = new Set(localList);

    const added = upstreamList.filter((f) => !localSet.has(f)).sort();
    const removed = localList.filter((f) => !upstreamSet.has(f)).sort();
    const common = upstreamList.filter((f) => localSet.has(f));
    const modified = common
      .filter((f) => !sameContent(path.join(tmp, f), path.join(templateAbs, f)))
      .sort();

    // Apply: write added + modified, delete removed. Unchanged files are left alone.
    if (!opts.dryRun) {
      for (const f of [...added, ...modified]) {
        copyInto(path.join(tmp, f), path.join(templateAbs, f));
      }
      for (const f of removed) {
        rmSync(path.join(templateAbs, f), { force: true });
      }
    }

    const changed = added.length + removed.length + modified.length;
    const lines = [];
    lines.push(`Upstream:     ${opts.upstream}`);
    lines.push(`Upstream HEAD: ${upstreamHead}`);
    lines.push(`Target:       ${TEMPLATE_DIR}/${opts.dryRun ? "  (dry run — no files changed)" : ""}`);
    lines.push("");
    if (changed === 0) {
      lines.push("No delta — template-plugin/ already matches upstream. Nothing to propagate.");
    } else {
      lines.push(`Delta: ${added.length} added, ${modified.length} modified, ${removed.length} removed.`);
      const show = (label, arr) => {
        if (arr.length) {
          lines.push("");
          lines.push(`${label}:`);
          for (const f of arr) lines.push(`  ${f}`);
        }
      };
      show("ADDED (read these files directly)", added);
      show("MODIFIED (inspect via `git diff template-plugin/<file>`)", modified);
      show("REMOVED", removed);
      lines.push("");
      lines.push(
        opts.dryRun
          ? "Dry run: working tree NOT modified. Re-run without --dry-run to apply."
          : "Working tree updated. NOT staged — review before propagating."
      );
    }
    process.stdout.write(lines.join("\n") + "\n");

    if (opts.json) {
      const payload = {
        upstream: opts.upstream,
        upstreamHead,
        templateDir: TEMPLATE_DIR,
        added,
        modified,
        removed,
        changedCount: changed,
      };
      process.stdout.write("\n---JSON---\n" + JSON.stringify(payload, null, 2) + "\n");
    }
  } catch (e) {
    process.stderr.write(`pull-template: fatal: ${e.message}\n`);
    process.exitCode = 1;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main();
