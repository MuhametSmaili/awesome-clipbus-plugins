/**
 * sdk-api-diff.mjs — Diff the @clipbus/plugin-sdk API surface between two versions.
 *
 * WHY THIS EXISTS (a real lesson, not a nicety): when a template update is "just"
 * an SDK version bump, the only thing that changes in the repo is a version string
 * in package.json. The actual impact lives INSIDE the SDK package. Worse, ADDITIVE
 * APIs (a new capability / host event) do NOT fail `npm run verify` — plugins keep
 * compiling green while quietly missing a capability they may want to adopt. So a
 * file-diff + verify-green is NOT enough to understand an SDK bump. You must diff
 * the SDK's own API.md + root Markdown references + docs/ tutorials between the
 * old and new versions. This script does that deterministically.
 *
 * It npm-packs both versions (no install, no repo mutation) and reports:
 *   - the Overview counts (capabilities / host events) for each version
 *   - public method names ADDED / REMOVED (parsed from API.md, with count checks)
 *   - the unified diff of API.md (authoritative human-readable surface)
 *   - unified diffs for changed root Markdown references and docs/ tutorials
 *
 * Usage:
 *   node sdk-api-diff.mjs [repoRoot] [--old <ver>] [--new <ver>]
 *     --old  old version (default: template-plugin/package.json at git HEAD,
 *            then the first plugin's installed/package.json version as fallback)
 *     --new  new version (default: template-plugin/package.json SDK version)
 *
 * stdout: the report. stderr: diagnostics. Read-only w.r.t. the repo.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const PKG = "@clipbus/plugin-sdk";

function parseArgs(argv) {
  const opts = { repoRoot: null, old: null, new: null };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--old") opts.old = argv[++i];
    else if (a === "--new") opts.new = argv[++i];
    else positional.push(a);
  }
  opts.repoRoot = path.resolve(positional[0] ?? process.cwd());
  return opts;
}

const stripRange = (v) => (v ? v.replace(/^[\^~]/, "").trim() : null);

function readJSON(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function sdkRangeFromPkg(pkgPath) {
  const pkg = readJSON(pkgPath);
  if (!pkg) return null;
  return pkg.dependencies?.[PKG] ?? pkg.devDependencies?.[PKG] ?? null;
}

function sdkRangeFromGitHead(repoRoot) {
  try {
    const raw = execFileSync("git", ["show", "HEAD:template-plugin/package.json"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const pkg = JSON.parse(raw);
    return pkg.dependencies?.[PKG] ?? pkg.devDependencies?.[PKG] ?? null;
  } catch {
    return null;
  }
}

function firstPluginDir(repoRoot) {
  return readdirSync(repoRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^clipbus-.+-plugin$/.test(e.name))
    .map((e) => e.name)
    .sort()[0];
}

function resolveVersions(opts) {
  let nw = opts.new;
  if (!nw) nw = stripRange(sdkRangeFromPkg(path.join(opts.repoRoot, "template-plugin", "package.json")));
  let old = opts.old;
  if (!old) {
    old = stripRange(sdkRangeFromGitHead(opts.repoRoot));
    if (!old) {
      const p = firstPluginDir(opts.repoRoot);
      if (p) {
        const installed = readJSON(path.join(opts.repoRoot, p, "node_modules", PKG, "package.json"));
        old = installed?.version ?? stripRange(sdkRangeFromPkg(path.join(opts.repoRoot, p, "package.json")));
      }
    }
  }
  return { old, new: nw };
}

function pack(version, destDir) {
  mkdirSync(destDir, { recursive: true });
  // npm pack prints the tarball name on the last stdout line.
  const out = execFileSync("npm", ["pack", `${PKG}@${version}`, "--pack-destination", destDir], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const tgz = out.trim().split("\n").pop().trim();
  const tgzPath = path.join(destDir, tgz);
  execFileSync("tar", ["xf", tgzPath, "-C", destDir], { stdio: "ignore" });
  return path.join(destDir, "package"); // npm tarballs extract to ./package
}

function overviewCounts(apiMd) {
  const cap = apiMd.match(/(?:Capabilities|Methods)\*\*:\s*(\d+)/)?.[1];
  const ev = apiMd.match(/(?:Host events|Events)\*\*:\s*(\d+)/)?.[1];
  if (cap === undefined || ev === undefined) throw new Error("Unrecognized API.md overview; inspect the new SDK format before classifying changes.");
  return { cap, ev };
}

function capabilityNames(sdkRoot) {
  // API.md is the public truth source in both protocol generations. V2 no
  // longer ships the V1 generated capability-client declaration.
  const api = readFileSync(path.join(sdkRoot, "API.md"), "utf8");
  const section = api.match(/## 2\. (?:Capabilities|Methods)\n([\s\S]*?)(?=\n## 3\.)/)?.[1];
  if (section === undefined) throw new Error("Cannot locate methods in API.md");
  const names = [...section.matchAll(/^(?:#### `|\| `)([^`]+)`/gm)].map((match) => match[1]);
  const expected = Number(overviewCounts(api).cap);
  if (names.length !== expected) throw new Error(`Extracted ${names.length} methods, expected ${expected}; inspect API.md format.`);
  return new Set(names);
}

function listFiles(dir) {
  const out = [];
  const walk = (d, rel) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), r);
      else out.push(r);
    }
  };
  walk(dir, "");
  return out;
}

function listRootMarkdown(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md") && e.name !== "API.md")
    .map((e) => e.name)
    .sort();
}

function sameFile(a, b) {
  try {
    return readFileSync(a).equals(readFileSync(b));
  } catch {
    return false;
  }
}

function unifiedDiff(a, b) {
  try {
    return execFileSync("diff", ["-u", a, b], { encoding: "utf8" });
  } catch (e) {
    // diff exits 1 when files differ — that's the normal case, output is on stdout.
    return e.stdout ?? `(diff failed: ${e.message})`;
  }
}

function unifiedDiffOptional(oldPath, newPath) {
  return unifiedDiff(existsSync(oldPath) ? oldPath : "/dev/null", existsSync(newPath) ? newPath : "/dev/null");
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { old, new: nw } = resolveVersions(opts);
  if (!old || !nw) {
    process.stderr.write(
      `sdk-api-diff: could not resolve versions (old=${old}, new=${nw}). Pass --old/--new.\n`
    );
    process.exit(1);
  }
  if (old === nw) {
    process.stdout.write(`SDK old and new are the same version (${old}); no API diff.\n`);
    return;
  }

  const tmp = mkdtempSync(path.join(tmpdir(), "clipbus-sdkdiff-"));
  try {
    process.stderr.write(`sdk-api-diff: packing ${PKG}@${old} and @${nw} ...\n`);
    const oldRoot = pack(old, path.join(tmp, "old"));
    const newRoot = pack(nw, path.join(tmp, "new"));

    const oldApi = path.join(oldRoot, "API.md");
    const newApi = path.join(newRoot, "API.md");
    const oc = overviewCounts(readFileSync(oldApi, "utf8"));
    const nc = overviewCounts(readFileSync(newApi, "utf8"));

    const oldCaps = capabilityNames(oldRoot);
    const newCaps = capabilityNames(newRoot);
    const addedCaps = [...newCaps].filter((c) => !oldCaps.has(c)).sort();
    const removedCaps = [...oldCaps].filter((c) => !newCaps.has(c)).sort();

    const lines = [];
    lines.push(`SDK API diff: ${PKG}  ${old} → ${nw}`);
    lines.push("");
    lines.push(`Overview:  capabilities ${oc.cap} → ${nc.cap}   |   host events ${oc.ev} → ${nc.ev}`);
    lines.push(
      `Capabilities ADDED:   ${addedCaps.length ? addedCaps.join(", ") : "(none)"}`
    );
    lines.push(
      `Capabilities REMOVED: ${removedCaps.length ? removedCaps.join(", ") : "(none)"}`
    );
    if (removedCaps.length) {
      lines.push("  ⚠ REMOVED capabilities are breaking — plugins using them must be migrated.");
    }
    if (addedCaps.length) {
      lines.push(
        "  ℹ ADDED method names may be new abilities or replacements across protocol versions. Read migration docs before deciding adoption."
      );
    }

    // Root Markdown references can carry lifecycle and authoring semantics that
    // are not duplicated in API.md or docs/. Diff them explicitly.
    const oldRootDocs = new Set(listRootMarkdown(oldRoot));
    const newRootDocs = new Set(listRootMarkdown(newRoot));
    const rootDocsAdded = [...newRootDocs].filter((f) => !oldRootDocs.has(f)).sort();
    const rootDocsRemoved = [...oldRootDocs].filter((f) => !newRootDocs.has(f)).sort();
    const rootDocsModified = [...newRootDocs]
      .filter((f) => oldRootDocs.has(f) && !sameFile(path.join(oldRoot, f), path.join(newRoot, f)))
      .sort();
    lines.push("");
    lines.push("root Markdown changes (excluding API.md):");
    lines.push(`  added:    ${rootDocsAdded.join(", ") || "(none)"}`);
    lines.push(`  removed:  ${rootDocsRemoved.join(", ") || "(none)"}`);
    lines.push(`  modified: ${rootDocsModified.join(", ") || "(none)"}`);

    // docs/ changes
    const oldDocs = path.join(oldRoot, "docs");
    const newDocs = path.join(newRoot, "docs");
    const oldList = new Set(listFiles(oldDocs));
    const newList = new Set(listFiles(newDocs));
    const docsAdded = [...newList].filter((f) => !oldList.has(f)).sort();
    const docsRemoved = [...oldList].filter((f) => !newList.has(f)).sort();
    const docsModified = [...newList]
      .filter((f) => oldList.has(f) && !sameFile(path.join(oldDocs, f), path.join(newDocs, f)))
      .sort();
    lines.push("");
    lines.push("docs/ changes:");
    lines.push(`  added:    ${docsAdded.join(", ") || "(none)"}`);
    lines.push(`  removed:  ${docsRemoved.join(", ") || "(none)"}`);
    lines.push(`  modified: ${docsModified.join(", ") || "(none)"}`);

    lines.push("");
    lines.push("===== API.md unified diff =====");
    process.stdout.write(lines.join("\n") + "\n");
    process.stdout.write(unifiedDiff(oldApi, newApi));

    for (const f of [...rootDocsAdded, ...rootDocsRemoved, ...rootDocsModified]) {
      process.stdout.write(`\n===== root ${f} unified diff =====\n`);
      process.stdout.write(unifiedDiffOptional(path.join(oldRoot, f), path.join(newRoot, f)));
    }
    for (const f of [...docsAdded, ...docsRemoved, ...docsModified]) {
      process.stdout.write(`\n===== docs/${f} unified diff =====\n`);
      process.stdout.write(unifiedDiffOptional(path.join(oldDocs, f), path.join(newDocs, f)));
    }
  } catch (e) {
    process.stderr.write(`sdk-api-diff: fatal: ${e.message}\n`);
    process.exitCode = 1;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main();
