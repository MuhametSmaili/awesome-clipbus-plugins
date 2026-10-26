/**
 * survey.mjs — Scans the Clipbus plugin collection and outputs a JSON summary to stdout.
 *
 * Usage: node survey.mjs [repoRoot]
 *   repoRoot  Directory to scan (default: process.cwd())
 *
 * Output (stdout): JSON with existing plugins, categories, used IDs, and attachment types.
 * Diagnostics go to stderr so callers can parse stdout cleanly.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] ?? process.cwd());

/** Read a file as UTF-8; return null on any error. */
async function tryRead(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

/** Extract the first heading and up to 6 Feature list items from README content. */
function extractReadmeSummary(content) {
  if (!content) return "";
  const lines = content.split("\n");
  let firstHeading = "";
  const features = [];
  let inFeatures = false;

  for (const line of lines) {
    if (!firstHeading && /^#+\s/.test(line)) {
      firstHeading = line.replace(/^#+\s+/, "").trim();
    }
    // Enter a Features / 功能 section
    if (/^#+\s+(features?|功能)/i.test(line)) {
      inFeatures = true;
      continue;
    }
    // Exit on next heading
    if (inFeatures && /^#+\s/.test(line)) {
      inFeatures = false;
    }
    if (inFeatures && /^[-*]\s+/.test(line)) {
      features.push(line.replace(/^[-*]\s+/, "").trim());
      if (features.length >= 6) break;
    }
  }

  const parts = [];
  if (firstHeading) parts.push(firstHeading);
  if (features.length > 0) parts.push("Features: " + features.join("; "));
  return parts.join(" — ").slice(0, 400);
}

/** Derive category from directory name. */
function categoryFromDir(dir) {
  if (dir === "template-plugin") return "template";
  const m = dir.match(/^clipbus-(.+)-plugin$/);
  return m ? m[1] : "unknown";
}

async function main() {
  let entries;
  try {
    entries = await readdir(repoRoot, { withFileTypes: true });
  } catch (e) {
    process.stderr.write(`survey: cannot read repoRoot "${repoRoot}": ${e.message}\n`);
    process.exit(1);
  }

  const pluginDirs = entries
    .filter(
      (e) =>
        e.isDirectory() &&
        (e.name === "template-plugin" || /^clipbus-.+-plugin$/.test(e.name))
    )
    .map((e) => e.name)
    .sort();

  const pluginsIndexExists = (await tryRead(path.join(repoRoot, "README.md"))) !== null;

  const plugins = [];
  const usedDirs = [];
  const usedCategories = new Set();
  const usedPluginIds = new Set();
  const usedAttachmentTypes = new Set();

  for (const dir of pluginDirs) {
    const dirPath = path.join(repoRoot, dir);
    const category = categoryFromDir(dir);
    usedDirs.push(dir);
    usedCategories.add(category);

    const manifestContent = await tryRead(path.join(dirPath, "manifest.json"));
    if (!manifestContent) {
      process.stderr.write(`survey: no manifest.json in "${dir}", recording dir only\n`);
      plugins.push({
        dir,
        category,
        pluginId: null,
        title: null,
        detectors: [],
        renderers: [],
        actions: [],
        readmeSummary: "",
      });
      continue;
    }

    let manifest;
    try {
      manifest = JSON.parse(manifestContent);
    } catch (e) {
      process.stderr.write(`survey: invalid JSON in "${dir}/manifest.json": ${e.message}\n`);
      plugins.push({
        dir,
        category,
        pluginId: null,
        title: null,
        detectors: [],
        renderers: [],
        actions: [],
        readmeSummary: "",
      });
      continue;
    }

    const pluginId = manifest.plugin?.id ?? null;
    const title = manifest.plugin?.title ?? null;
    const detectors = Array.isArray(manifest.detectors)
      ? manifest.detectors.map((d) => d.id).filter(Boolean)
      : [];
    const renderers = Array.isArray(manifest.renderers)
      ? manifest.renderers
          .filter((r) => r.id)
          .map((r) => ({ id: r.id, attachmentType: r.attachmentType ?? null }))
      : [];
    const actions = Array.isArray(manifest.actions)
      ? manifest.actions
          .filter((a) => a.id)
          .map((a) => ({ id: a.id, inputKinds: a.inputKinds ?? [] }))
      : [];

    if (pluginId) usedPluginIds.add(pluginId);
    for (const type of manifest.writes?.attachmentTypes ?? []) usedAttachmentTypes.add(type);
    for (const r of renderers) {
      if (r.attachmentType) usedAttachmentTypes.add(r.attachmentType);
    }

    const readmeSummary = extractReadmeSummary(await tryRead(path.join(dirPath, "README.md")));

    plugins.push({ dir, category, pluginId, title, writes: manifest.writes ?? {}, detectors, renderers, actions, readmeSummary });
  }

  const result = {
    repoRoot,
    pluginsIndexExists,
    plugins,
    usedDirs,
    usedCategories: [...usedCategories].sort(),
    usedPluginIds: [...usedPluginIds].sort(),
    usedAttachmentTypes: [...usedAttachmentTypes].sort(),
  };

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main().catch((e) => {
  process.stderr.write(`survey: fatal: ${e.message}\n${e.stack ?? ""}\n`);
  process.exit(1);
});
