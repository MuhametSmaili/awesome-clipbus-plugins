/**
 * scaffold.mjs — Scaffolds a new Clipbus plugin from template-plugin.
 *
 * Usage: node scaffold.mjs <topic> [--title "Human Title"] [--repo <repoRoot>]
 *
 *   topic     kebab-case identifier, e.g. "json-tools" → creates clipbus-json-tools-plugin/
 *   --title   Human-readable plugin title (default: derived from topic)
 *   --repo    Repository root directory (default: process.cwd())
 *
 * The target directory must not already exist. After scaffolding, run:
 *   npm install && npm run verify
 */
import {
  cp,
  mkdir,
  readFile,
  writeFile,
  rm,
  readdir,
  stat,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Argument parsing ─────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  let topic = null;
  let title = null;
  let repoRoot = process.cwd();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--title" && args[i + 1]) {
      title = args[++i];
    } else if (args[i] === "--repo" && args[i + 1]) {
      repoRoot = path.resolve(args[++i]);
    } else if (!args[i].startsWith("--") && topic === null) {
      topic = args[i];
    }
  }
  return { topic, title, repoRoot };
}

function die(msg) {
  process.stderr.write(`scaffold: error: ${msg}\n`);
  process.exit(1);
}

// ── Naming helpers ───────────────────────────────────────────────────────────

/** "json-tools" → "Json Tools" */
function topicToTitle(topic) {
  return topic
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** "json-tools" → "plugin.json.tools" */
function topicToPluginId(topic) {
  return `plugin.${topic.replace(/-/g, ".")}`;
}

// ── Filesystem helpers ───────────────────────────────────────────────────────

/**
 * Recursively copy src → dest, skipping top-level entries in excludeNames.
 * Creates dest if it does not exist.
 */
async function copyDir(src, dest, excludeNames = new Set()) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (excludeNames.has(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath); // excludeNames only applied at top level
    } else {
      await cp(srcPath, destPath);
    }
  }
}

/** Remove a directory tree; silently succeed if it does not exist. */
async function rmDir(dirPath) {
  await rm(dirPath, { recursive: true, force: true });
}

/**
 * Walk a directory tree and delete every file for which predicate returns true.
 * Directories themselves are never deleted (even if emptied).
 */
async function deleteMatchingFiles(dirPath, predicate) {
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return; // directory may not exist
  }
  for (const entry of entries) {
    const p = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await deleteMatchingFiles(p, predicate);
    } else if (predicate(entry.name)) {
      await unlink(p);
    }
  }
}

async function writeJson(filePath, obj) {
  await writeFile(filePath, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

async function writeText(filePath, content) {
  await writeFile(filePath, content, "utf8");
}

// ── Scaffold content generators ──────────────────────────────────────────────

function minimalPluginTs() {
  return `import { definePlugin } from "@clipbus/plugin-sdk/runtime";

export default definePlugin({ detectors: {}, actions: {}, messages: [] });
`;
}

function minimalAttachmentScenariosTs() {
  return `// Add one real V2 card scenario per renderer; see SDK docs/preview.md.
// Use this plugin's identity, item snapshot and structured attachment.payload.
import type { PreviewScenario } from "@clipbus/plugin-sdk/preview";

export const attachmentScenarios: PreviewScenario[] = [];
`;
}

function minimalPreviewHostMainTs() {
  return `import { createPreviewWorkbench } from "@clipbus/plugin-sdk/preview";
import { createApp, h, type Component } from "vue";
import "../../shared/base.css";
import { attachmentScenarios } from "../scenarios/attachmentScenarios";

// Import each renderer app.vue and map it by scenario.view (the feature id).
const COMPONENTS: Record<string, Component> = {};
const root = document.getElementById("app")!;

if (attachmentScenarios.length === 0) {
  createApp({ render: () => h("main", "No card pages to preview. Runtime Actions are tested in Clipbus.") }).mount(root);
} else {
  createPreviewWorkbench(root, {
    scenarios: attachmentScenarios,
    mount(slotEl, { scenario }) {
      const component = COMPONENTS[scenario.view ?? ""];
      if (component === undefined) throw new Error("No card component for " + scenario.view);
      const app = createApp(component);
      app.mount(slotEl);
      return () => app.unmount();
    },
  });
}
`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { topic, title: titleArg, repoRoot } = parseArgs(process.argv);

  if (!topic) {
    die(
      "topic is required.\n" +
        "Usage: node scaffold.mjs <topic> [--title 'Human Title'] [--repo <repoRoot>]\n" +
        'Example: node scaffold.mjs json-tools --title "JSON Tools"'
    );
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(topic)) {
    die(
      `topic must be kebab-case (lowercase letters/digits, hyphen-separated).\n` +
        `  Valid:   "json-tools", "image-resize", "qr"\n` +
        `  Invalid: "${topic}"`
    );
  }

  const title = titleArg ?? topicToTitle(topic);
  const pluginId = topicToPluginId(topic);
  const pluginDirName = `clipbus-${topic}-plugin`;
  const targetDir = path.resolve(repoRoot, pluginDirName);
  const templateDir = path.resolve(repoRoot, "template-plugin");

  // Verify template-plugin exists
  try {
    const s = await stat(templateDir);
    if (!s.isDirectory()) die(`template-plugin is not a directory: ${templateDir}`);
  } catch {
    die(`template-plugin not found at ${templateDir}`);
  }

  // Refuse to overwrite an existing directory
  try {
    await stat(targetDir);
    die(`Target directory already exists: ${targetDir}\nRemove it first or choose a different topic.`);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    // expected — directory does not exist, proceed
  }

  process.stderr.write(`scaffold: creating ${pluginDirName} in ${repoRoot}\n`);

  // ── Step 1: Copy template-plugin (excluding node_modules and dist) ──────────
  await copyDir(templateDir, targetDir, new Set(["node_modules", "dist", ".git", ".omc", "package-lock.json"]));
  process.stderr.write(`scaffold: [1/8] copied template-plugin → ${pluginDirName}\n`);

  // ── Step 2: Delete template-specific feature directories and test files ──────
  await rmDir(path.join(targetDir, "src", "features"));
  await mkdir(path.join(targetDir, "src", "features"), { recursive: true });
  for (const file of ["src/shared/debug.ts", "src/shared/display.ts", "src/shared/digest.ts", "tests/support/png.cjs"]) {
    await rmDir(path.join(targetDir, file));
  }
  // Keep the generic built-runtime test harness, remove template test cases.
  await deleteMatchingFiles(
    path.join(targetDir, "tests"),
    (name) => name.endsWith(".test.cjs")
  );
  process.stderr.write(`scaffold: [2/8] removed template feature dirs and test files\n`);

  // ── Step 3: Overwrite scripts with generic scaffold versions ─────────────────
  const scaffoldScriptsDir = path.resolve(__dirname, "..", "assets", "scaffold", "scripts");
  await cp(
    path.join(scaffoldScriptsDir, "build-ui.mjs"),
    path.join(targetDir, "scripts", "build-ui.mjs")
  );
  await cp(
    path.join(scaffoldScriptsDir, "verify-build.mjs"),
    path.join(targetDir, "scripts", "verify-build.mjs")
  );
  process.stderr.write(`scaffold: [3/8] replaced scripts/build-ui.mjs and verify-build.mjs\n`);

  // ── Step 4: Rewrite package.json ─────────────────────────────────────────────
  const pkgPath = path.join(targetDir, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  pkg.name = `@clipbus/${topic}-plugin`;
  pkg.description = `${title} plugin for Clipbus.`;
  // Preserve all other fields (scripts, dependencies, devDependencies, etc.)
  await writeJson(pkgPath, pkg);
  process.stderr.write(`scaffold: [4/8] rewrote package.json (name: @clipbus/${topic}-plugin)\n`);

  // ── Step 5: Rewrite manifest.json as empty capability skeleton ───────────────
  const templateManifest = JSON.parse(
    await readFile(path.join(templateDir, "manifest.json"), "utf8")
  );
  const newManifest = {
    schemaVersion: templateManifest.schemaVersion ?? 5,
    plugin: {
      id: pluginId,
      title,
      version: "0.1.0",
    },
    install: templateManifest.install,
    runtime: templateManifest.runtime,
    detectors: [],
    renderers: [],
    writes: { attachmentTypes: [], searchScopes: [] },
    actions: [],
  };
  await writeJson(path.join(targetDir, "manifest.json"), newManifest);
  process.stderr.write(`scaffold: [5/8] rewrote manifest.json (id: ${pluginId})\n`);

  // ── Step 6: Rewrite src/plugin.ts as minimal skeleton ───────────────────────
  await writeText(path.join(targetDir, "src", "plugin.ts"), minimalPluginTs());
  process.stderr.write(`scaffold: [6/8] rewrote src/plugin.ts\n`);

  // ── Step 7: Replace preview scenarios + preview-host entry ──────────────────
  // The copied template main.ts imports template demo features (deleted in Step 2),
  // so overwrite it with a clean createPreviewWorkbench host (empty COMPONENTS map).
  await writeText(
    path.join(targetDir, "src", "preview", "scenarios", "attachmentScenarios.ts"),
    minimalAttachmentScenariosTs()
  );
  await writeText(
    path.join(targetDir, "src", "preview", "preview-host", "main.ts"),
    minimalPreviewHostMainTs()
  );
  // Defensive: drop any stale hand-rolled shell (pre-0.8.5 templates shipped one).
  await rmDir(path.join(targetDir, "src", "preview", "PreviewShellApp.vue"));
  process.stderr.write(`scaffold: [7/8] replaced preview scenarios + preview-host/main.ts\n`);

  await mkdir(path.join(targetDir, "tests", "runtime"), { recursive: true });
  await writeText(path.join(targetDir, "tests", "runtime", "plugin.test.cjs"), `const test = require("node:test");
const assert = require("node:assert/strict");
const { manifest, setupPlugin } = require("../support/plugin.cjs");

test("built runtime registers the declared detector and Action handlers", async t => {
  const { registry } = await setupPlugin(t);
  for (const kind of ["detectors", "actions"]) {
    assert.deepEqual(Object.keys(registry[kind] ?? {}).sort(), (manifest[kind] ?? []).map(entry => entry.id).sort());
  }
});
`);

  // ── Step 8: Confirm preserved files ─────────────────────────────────────────
  // (src/shared/, tsconfig.json, vite.config.mjs, eslint.config.mjs, env.d.ts,
  //  .gitignore, scripts/build-runtime.mjs, scripts/install.mjs were all
  //  copied in Step 1 and are untouched.)
  process.stderr.write(`scaffold: [8/8] preserved shared/, tsconfig, vite/eslint configs\n`);

  console.log(`
Scaffold complete: ${targetDir}

Plugin id : ${pluginId}
Title     : ${title}

Next steps:
  cd ${pluginDirName}
  npm install
  # Author capabilities in src/features/<id>/  (dir name === manifest id)
  # Register them in src/plugin.ts and manifest.json
  npm run verify
`);
}

main().catch((e) => {
  process.stderr.write(`scaffold: fatal: ${e.message}\n${e.stack ?? ""}\n`);
  process.exit(1);
});
