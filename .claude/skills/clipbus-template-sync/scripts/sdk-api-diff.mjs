/**
 * sdk-api-diff.mjs — Diff the @clipbus/plugin-sdk API surface between two versions.
 *
 * WHY THIS EXISTS (a real lesson, not a nicety): when a template update is "just"
 * an SDK version bump, the only thing that changes in the repo is a version string
 * in package.json. The actual impact lives INSIDE the SDK package. Worse, ADDITIVE
 * APIs (a new capability / host event) do NOT fail `npm run verify` — plugins keep
 * compiling green while quietly missing a capability they may want to adopt. So a
 * file-diff + verify-green is NOT enough to understand an SDK bump. You must diff
 * the SDK's own API.md + docs between the old and new versions. This script does
 * that deterministically.
 *
 * It npm-packs both versions (no install, no repo mutation) and reports:
 *   - the Overview counts (capabilities / host events) for each version
 *   - capability method names ADDED / REMOVED (set-diff of CAPABILITY_METHOD_NAMES)
 *   - the unified diff of API.md (authoritative human-readable surface)
 *   - which docs/ files were added / removed / modified
 *
 * Usage:
 *   node sdk-api-diff.mjs [repoRoot] [--old <ver>] [--new <ver>]
 *     --old  old version (default: SDK version installed in the first plugin,
 *            else that plugin's package.json range, with ^/~ stripped)
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
    const p = firstPluginDir(opts.repoRoot);
    if (p) {
      const installed = readJSON(path.join(opts.repoRoot, p, "node_modules", PKG, "package.json"));
      old = installed?.version ?? stripRange(sdkRangeFromPkg(path.join(opts.repoRoot, p, "package.json")));
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
  const cap = apiMd.match(/Capabilities\*\*:\s*(\d+)/)?.[1] ?? "?";
  const ev = apiMd.match(/Host events\*\*:\s*(\d+)/)?.[1] ?? "?";
  return { cap, ev };
}

function capabilityNames(sdkRoot) {
  // The generated file holding CAPABILITY_METHOD_NAMES gets renamed across SDK
  // versions (0.10.0: capabilityClients.generated → capabilities.generated), so
  // scan every d.ts under dist/ instead of hard-coding one filename.
  const distDir = path.join(sdkRoot, "dist");
  const dts = existsSync(distDir) ? listFiles(distDir).filter((f) => f.endsWith(".d.ts")) : [];
  for (const rel of dts) {
    const txt = readFileSync(path.join(distDir, rel), "utf8");
    // d.ts declares it with a colon + type: `CAPABILITY_METHOD_NAMES: readonly [...]`
    // (a .js build may use `= [...]`), so accept either `:` or `=`.
    const m = txt.match(/CAPABILITY_METHOD_NAMES\s*[:=]\s*(?:readonly\s*)?\[([^\]]*)\]/s);
    if (m) return new Set([...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
  }
  // Fallback: the `#### \`name\`` headings of API.md §2 (codegen truth source).
  const apiPath = path.join(sdkRoot, "API.md");
  const apiMd = existsSync(apiPath) ? readFileSync(apiPath, "utf8") : "";
  const section = apiMd.split(/^## 2\. Capabilities/m)[1]?.split(/^## 3\./m)[0] ?? "";
  return new Set([...section.matchAll(/^#### `([^`]+)`/gm)].map((x) => x[1]));
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
        "  ℹ ADDED capabilities are additive — verify stays GREEN even if unused. Decide per plugin whether to adopt."
      );
    }

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
  } catch (e) {
    process.stderr.write(`sdk-api-diff: fatal: ${e.message}\n`);
    process.exitCode = 1;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main();
