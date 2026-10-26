/**
 * grade.mjs — 客观核验一个生成出来的 Clipbus 插件是否满足结构性断言。
 *
 * 用法: node grade.mjs <repoRoot> <pluginDir>
 *   repoRoot   合集仓库根（含 README.md / README_zh.md 索引与各插件目录）
 *   pluginDir  插件目录名，如 clipbus-decoder-plugin
 *
 * 输出: stdout 打印 JSON { plugin, checks:[{name,passed,evidence}], passedCount, total }
 * 注意: "npm run verify 全绿" 这条不在此脚本内跑（耗时/需环境），由调用方真实运行后另记。
 *       本脚本检查结构、接线、索引、以及（若能加载）解码逻辑等可静态/轻量核验项。
 */
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [, , repoRootArg, pluginDirArg] = process.argv;
if (!repoRootArg || !pluginDirArg) {
  process.stderr.write("usage: node grade.mjs <repoRoot> <pluginDir>\n");
  process.exit(2);
}
const repoRoot = path.resolve(repoRootArg);
const pluginDir = pluginDirArg;
const root = path.join(repoRoot, pluginDir);

const checks = [];
function add(name, passed, evidence) {
  checks.push({ name, passed: !!passed, evidence: String(evidence ?? "") });
}
async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}
async function tryRead(p) {
  try { return await readFile(p, "utf8"); } catch { return null; }
}

async function main() {
  // 1. 插件目录存在
  add("插件目录存在", await exists(root), root);

  // 2. manifest 可解析 + plugin.id
  const manifestRaw = await tryRead(path.join(root, "manifest.json"));
  let manifest = null;
  try { manifest = manifestRaw ? JSON.parse(manifestRaw) : null; } catch { /* */ }
  const pluginId = manifest?.plugin?.id ?? null;
  // 期望 id：clipbus-<topic>-plugin → plugin.<topic 以 . 连接>
  const topicMatch = pluginDir.match(/^clipbus-(.+)-plugin$/);
  const expectedId = topicMatch ? `plugin.${topicMatch[1].replace(/-/g, ".")}` : null;
  add("manifest 可解析", !!manifest, manifestRaw ? "parsed" : "missing/invalid");
  add(
    "plugin.id 符合 plugin.<topic>",
    pluginId && (!expectedId || pluginId === expectedId),
    `id=${pluginId} expected=${expectedId}`
  );

  const detectors = manifest?.detectors ?? [];
  const renderers = manifest?.renderers ?? [];
  const actions = manifest?.actions ?? [];

  add("manifest 使用 schema v5", manifest?.schemaVersion === 5, manifest?.schemaVersion);
  add("至少有一个有效能力", detectors.length + renderers.length + actions.length > 0,
    `detectors=${detectors.length} renderers=${renderers.length} actions=${actions.length}`);

  // Execute the delivered verifier: string matching cannot validate imported handlers.
  let registryEvidence;
  let registryOk = false;
  try {
    registryEvidence = execFileSync(process.execPath, [path.join(root, "scripts/verify-build.mjs")], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    registryOk = true;
  } catch (error) {
    registryEvidence = error.stderr?.toString() ?? error.message;
  }
  add("构建产物的 handler 与页面引用正确", registryOk, registryEvidence);

  // Card pages are the only UI contributions.
  const uiIds = renderers.map((r) => r.id).filter(Boolean);
  const badUiDirs = [];
  for (const id of uiIds) {
    const d = path.join(root, "src/features", id);
    const ok = (await exists(path.join(d, "main.ts"))) && (await exists(path.join(d, "index.html")));
    if (!ok) badUiDirs.push(id);
  }
  add(
    "UI 能力有同名 feature 目录(含 main.ts+index.html)",
    badUiDirs.length === 0,
    badUiDirs.length ? `缺/不全: ${badUiDirs.join(",")}` : `${uiIds.length} 个 UI 目录齐全`
  );

  // 6. README 写明功能
  const readme = (await tryRead(path.join(root, "README.md"))) ?? "";
  add("README.md 存在且非空", readme.trim().length > 80, `${readme.length} chars`);

  // 7. 根索引 README.md（英文主页）收录该插件
  const pluginsIndex = (await tryRead(path.join(repoRoot, "README.md"))) ?? "";
  add(
    "根 README.md 收录该插件",
    pluginsIndex.includes(pluginDir),
    pluginsIndex ? (pluginsIndex.includes(pluginDir) ? "found" : "未提到该插件") : "README.md 缺失"
  );

  // 8. dist 产物存在（npm run build 跑过的代理证据；权威绿/红由调用方真实 verify）
  add("manifest 的 runtime 产物存在", !manifest?.runtime?.nodeEntry || await exists(path.join(root, manifest.runtime.nodeEntry)), manifest?.runtime?.nodeEntry ?? "card-only plugin");

  const passedCount = checks.filter((c) => c.passed).length;
  process.stdout.write(JSON.stringify(
    { plugin: pluginDir, checks, passedCount, total: checks.length },
    null, 2
  ) + "\n");
}

main().catch((e) => {
  process.stderr.write(`grade: fatal: ${e.message}\n`);
  process.exit(1);
});
