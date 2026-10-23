/**
 * check-consistency.mjs — After a template sync + plugin migration, verify the
 * shared infrastructure has actually converged across every plugin.
 *
 * Why dynamic instead of a hardcoded shared-file list: the set of "shared infra"
 * files GROWS over time (a template update can introduce a new shared module),
 * but the set of per-plugin CUSTOM files is structurally stable (manifest,
 * plugin.ts, features, preview, readme, package.json). So we derive the shared
 * set from template-plugin's ACTUAL tracked files minus a small custom denylist.
 * This never goes stale and never references files that don't exist.
 *
 * Checks:
 *   1. Verbatim-shared — every tracked file under template-plugin/ that is NOT in
 *      the custom denylist (and not one of the two divergent build scripts) must
 *      exist in each plugin and match template byte-for-byte. Missing or differing
 *      files are reported.
 *   2. package.json — @clipbus/plugin-sdk version and the scripts block must match
 *      template. name / description / private / extra deps may legitimately differ.
 *   3. build-ui.mjs / verify-build.mjs — these intentionally DIVERGE from template
 *      (template ships demo-specific versions; plugins use the generic
 *      manifest-driven versions). They are not compared to template; instead they
 *      must be MUTUALLY consistent across plugins. Plugin-to-plugin drift is
 *      reported.
 *
 * Exit code: 0 = consistent, 1 = divergence found (so a run can gate on it).
 * Usage: node check-consistency.mjs [repoRoot] [--json]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const TEMPLATE_DIR = "template-plugin";

// Per-plugin custom paths — never expected to match template. Stable by design.
const DENY_EXACT = new Set([
  "manifest.json",
  "src/plugin.ts",
  "package.json", // handled by check #2
  "package-lock.json", // per-plugin derived lockfile; legitimately differs (template no longer ships one)
  "README.md",
  "README_zh.md",
  "GUIDE.md",
  "GUIDE_zh.md",
  ".gitignore",
  ".DS_Store",
]);
const DENY_PREFIX = ["src/features/", "src/preview/"];
// Test CASE files are per-plugin (each plugin tests its own features); only the
// shared harness like tests/setup.cjs is verbatim-shared. So exclude *.test.* but
// keep everything else under tests/.
const DENY_SUFFIX = /\.test\.(c|m)?js$/;
// Verbatim-shared, but a plugin may omit any it doesn't use (see check #1).
const OPTIONAL_SHARED_PREFIX = "src/shared/";
// Intentionally divergent from template — handled by check #3.
const DIVERGENT = ["scripts/build-ui.mjs", "scripts/verify-build.mjs"];

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function trackedFiles(repoRoot, subdir) {
  const out = git(repoRoot, ["ls-files", "-z", subdir]);
  const prefix = subdir.replace(/\/?$/, "/");
  return out
    .split("\0")
    .filter(Boolean)
    .map((p) => (p.startsWith(prefix) ? p.slice(prefix.length) : p));
}

function listPlugins(repoRoot) {
  const out = git(repoRoot, ["ls-files", "-z", "--", "*/manifest.json"]);
  const dirs = new Set();
  for (const p of out.split("\0").filter(Boolean)) {
    const dir = p.split("/")[0];
    if (/^clipbus-.+-plugin$/.test(dir)) dirs.add(dir);
  }
  return [...dirs].sort();
}

function isShared(rel) {
  if (DENY_EXACT.has(rel)) return false;
  if (DIVERGENT.includes(rel)) return false;
  if (DENY_SUFFIX.test(rel)) return false;
  if (DENY_PREFIX.some((p) => rel.startsWith(p))) return false;
  return true;
}

function sameFile(a, b) {
  try {
    return readFileSync(a).equals(readFileSync(b));
  } catch {
    return false;
  }
}

function readJSON(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function sdkVersion(pkg) {
  if (!pkg) return null;
  return (
    pkg.dependencies?.["@clipbus/plugin-sdk"] ??
    pkg.devDependencies?.["@clipbus/plugin-sdk"] ??
    null
  );
}

function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  const repoRoot = path.resolve(argv.find((a) => !a.startsWith("--")) ?? process.cwd());

  const templateAbs = path.join(repoRoot, TEMPLATE_DIR);
  if (!existsSync(templateAbs)) {
    process.stderr.write(`check-consistency: ${TEMPLATE_DIR}/ not found under ${repoRoot}\n`);
    process.exit(1);
  }

  const plugins = listPlugins(repoRoot);
  const sharedFiles = trackedFiles(repoRoot, TEMPLATE_DIR).filter(isShared);
  const tplPkg = readJSON(path.join(templateAbs, "package.json"));
  const tplSdk = sdkVersion(tplPkg);
  const tplScripts = JSON.stringify(tplPkg?.scripts ?? {});

  const issues = [];

  // Check 1 — verbatim-shared files.
  for (const plugin of plugins) {
    for (const rel of sharedFiles) {
      const pluginFile = path.join(repoRoot, plugin, rel);
      const tplFile = path.join(templateAbs, rel);
      if (!existsSync(pluginFile)) {
        // src/shared/* are optional helpers: plugins may delete ones they don't
        // import (fdb8547 dropped unused debug.ts/display.ts); a still-needed
        // helper would fail typecheck. Only a present copy must match.
        if (rel.startsWith(OPTIONAL_SHARED_PREFIX)) continue;
        issues.push({ check: "shared", plugin, file: rel, kind: "missing" });
      } else if (!sameFile(pluginFile, tplFile)) {
        issues.push({ check: "shared", plugin, file: rel, kind: "differs" });
      }
    }
  }

  // Check 2 — package.json SDK version + scripts block.
  for (const plugin of plugins) {
    const pkg = readJSON(path.join(repoRoot, plugin, "package.json"));
    if (!pkg) {
      issues.push({ check: "package.json", plugin, file: "package.json", kind: "unreadable" });
      continue;
    }
    if (sdkVersion(pkg) !== tplSdk) {
      issues.push({
        check: "package.json",
        plugin,
        file: "@clipbus/plugin-sdk",
        kind: "sdk-mismatch",
        detail: `${sdkVersion(pkg)} != template ${tplSdk}`,
      });
    }
    if (JSON.stringify(pkg.scripts ?? {}) !== tplScripts) {
      issues.push({ check: "package.json", plugin, file: "scripts", kind: "scripts-mismatch" });
    }
  }

  // Check 3 — divergent build scripts must be mutually consistent across plugins.
  for (const rel of DIVERGENT) {
    const have = plugins.filter((p) => existsSync(path.join(repoRoot, p, rel)));
    if (have.length < 2) continue;
    const ref = have[0];
    for (const plugin of have.slice(1)) {
      if (!sameFile(path.join(repoRoot, ref, rel), path.join(repoRoot, plugin, rel))) {
        issues.push({
          check: "divergent",
          plugin,
          file: rel,
          kind: "plugin-drift",
          detail: `differs from ${ref}`,
        });
      }
    }
  }

  if (json) {
    process.stdout.write(
      JSON.stringify({ repoRoot, plugins, sharedFileCount: sharedFiles.length, issues }, null, 2) + "\n"
    );
  } else {
    process.stdout.write(`Plugins checked: ${plugins.length} (${plugins.join(", ")})\n`);
    process.stdout.write(`Shared files derived from template: ${sharedFiles.length}\n\n`);
    if (issues.length === 0) {
      process.stdout.write("✓ All plugins are consistent with the template's shared infrastructure.\n");
    } else {
      process.stdout.write(`✗ ${issues.length} consistency issue(s):\n`);
      for (const i of issues) {
        process.stdout.write(
          `  [${i.check}] ${i.plugin} :: ${i.file} — ${i.kind}${i.detail ? ` (${i.detail})` : ""}\n`
        );
      }
    }
  }

  process.exit(issues.length === 0 ? 0 : 1);
}

main();
