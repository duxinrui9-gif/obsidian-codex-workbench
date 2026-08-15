import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, relative, sep } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ignoredDirectories = new Set([".git", ".next", "node_modules", ".workbench-data", ".playwright-cli", ".imports", "coverage"]);
// Local runtime settings are deliberately excluded from a public checkout.
// Their Git-ignore status is checked separately before release staging.
const ignoredFiles = new Set([".env.local"]);
const forbiddenNames = new Set([".env.local", "INTERNAL-LICENSE.txt"]);
const forbiddenText = [
  { label: "absolute user path", pattern: /\/Users\// },
  { label: "legacy local email", pattern: /fixdog@FixdeMacBook-Pro\.local/i },
  { label: "GitHub token", pattern: /gh[ops]_[A-Za-z0-9_]{20,}/ },
  { label: "OpenAI-style secret", pattern: /\bsk-(?:proj-)?[A-Za-z0-9]{20,}\b/ },
  { label: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) continue;
    if (ignoredFiles.has(entry)) continue;
    const path = resolve(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

function assertFile(path) {
  try { statSync(path); } catch { throw new Error(`missing required file: ${relative(root, path)}`); }
}

function main() {
  const failures = [];
  const files = walk(root);
  for (const path of files) {
    const rel = relative(root, path);
    if (forbiddenNames.has(rel.split(sep).at(-1))) failures.push(`forbidden file: ${rel}`);
    const body = readFileSync(path);
    if (body.includes(0)) continue;
    const text = body.toString("utf8");
    for (const { label, pattern } of forbiddenText) if (pattern.test(text)) failures.push(`${label}: ${rel}`);
  }

  const starter = resolve(root, "starter-vault");
  const required = [
    "AGENTS.md", "00_从这里开始.md", "00_知识库配置.md", "00_首页.md",
    "90_System/Bases/待办.base", "90_System/Bases/日报.base", "90_System/Bases/周复盘.base", "90_System/Bases/月度复盘.base",
    "98_Templates/待办事项.md", "98_Templates/项目主页.md", "98_Templates/来源笔记.md", "98_Templates/知识卡片.md",
  ];
  for (const item of required) {
    try { assertFile(resolve(starter, item)); } catch (error) { failures.push(error.message); }
  }
  const action = readFileSync(resolve(starter, "98_Templates/待办事项.md"), "utf8");
  for (const key of ["action_state", "next_action", "completion_standard", "start_on", "due_on", "scheduled_for", "review_on", "carryover_count", "completion_evidence", "source_threads"]) {
    if (!action.includes(`${key}:`)) failures.push(`action template lacks ${key}`);
  }
  const project = readFileSync(resolve(starter, "98_Templates/项目主页.md"), "utf8");
  for (const token of ["{{title}}", "{{date:YYYY-MM-DD}}", "target_date:", "目标与成功标准", "下一步行动"]) {
    if (!project.includes(token)) failures.push(`project template lacks ${token}`);
  }
  const profile = readFileSync(resolve(root, "lib/vault-profile.ts"), "utf8");
  if (!profile.includes('WORKBENCH_WRITE_ENABLED === "true"')) failures.push("workbench write gate is not explicit opt-in");

  if (failures.length) {
    console.error("Release verification failed:");
    for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`Release verification passed (${files.length} checked files).`);
}

main();
