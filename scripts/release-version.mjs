#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryUrl = "https://github.com/duxinrui9-gif/obsidian-codex-workbench";
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const tagPattern = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseVersion(value) {
  const match = versionPattern.exec(value);
  if (!match) throw new Error(`版本必须是稳定的 X.Y.Z：${value}`);
  return { raw: value, major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function compareVersions(left, right) {
  const a = typeof left === "string" ? parseVersion(left) : left;
  const b = typeof right === "string" ? parseVersion(right) : right;
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
  }
  return 0;
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function stripReferenceLinks(markdown) {
  return markdown.replace(/\n*\[Unreleased\]:[^\n]*(?:\n\[v\d+\.\d+\.\d+\]:[^\n]*)*\s*$/u, "").trimEnd();
}

export function parseChangelog(markdown) {
  const source = `${stripReferenceLinks(markdown).replace(/\r\n/g, "\n")}\n`;
  if (!source.startsWith("# Changelog\n")) throw new Error("CHANGELOG.md 必须以 # Changelog 开头");
  const headings = [...source.matchAll(/^## (Unreleased|v(\d+\.\d+\.\d+))(?: — (\d{4}-\d{2}-\d{2}))?$/gmu)];
  if (!headings.length) throw new Error("CHANGELOG.md 缺少版本段落");
  const sections = headings.map((heading, index) => {
    const title = heading[1];
    const version = heading[2] ?? "";
    const date = heading[3] ?? "";
    if (title !== "Unreleased") {
      parseVersion(version);
      if (!isRealDate(date)) throw new Error(`版本 ${version} 的发布日期无效`);
    } else if (date) {
      throw new Error("Unreleased 段落不能包含发布日期");
    }
    const bodyStart = heading.index + heading[0].length;
    const bodyEnd = headings[index + 1]?.index ?? source.length;
    return { title, version, date, content: source.slice(bodyStart, bodyEnd).trim(), start: heading.index, end: bodyEnd };
  });
  const unreleased = sections.filter((section) => section.title === "Unreleased");
  if (unreleased.length !== 1) throw new Error("CHANGELOG.md 必须且只能包含一个 Unreleased 段落");
  const releases = sections.filter((section) => section.version);
  const seen = new Set();
  for (const section of releases) {
    if (seen.has(section.version)) throw new Error(`CHANGELOG.md 包含重复版本：${section.version}`);
    if (!section.content) throw new Error(`版本 ${section.version} 缺少发布说明`);
    seen.add(section.version);
  }
  for (let index = 1; index < releases.length; index += 1) {
    if (compareVersions(releases[index - 1].version, releases[index].version) <= 0) throw new Error("CHANGELOG.md 的版本必须从新到旧排列");
  }
  return { source, sections, unreleased: unreleased[0], releases };
}

function packagePath(root) { return resolve(root, "package.json"); }
function changelogPath(root) { return resolve(root, "CHANGELOG.md"); }

function readPackage(root) {
  return JSON.parse(readFileSync(packagePath(root), "utf8"));
}

export function assertReleaseContract(root = repoRoot, tag = "") {
  const manifest = readPackage(root);
  const version = parseVersion(manifest.version).raw;
  const changelog = parseChangelog(readFileSync(changelogPath(root), "utf8"));
  const release = changelog.releases.find((section) => section.version === version);
  if (!release) throw new Error(`package.json 版本 ${version} 缺少对应 CHANGELOG 段落`);
  if (tag) {
    const match = tagPattern.exec(tag);
    if (!match) throw new Error(`标签必须是稳定的 vX.Y.Z：${tag}`);
    if (tag.slice(1) !== version) throw new Error(`标签 ${tag} 与 package.json 版本 ${version} 不一致`);
  }
  return { version, manifest, changelog, release };
}

function versionLinks(versions) {
  const links = [`[Unreleased]: ${repositoryUrl}/compare/v${versions[0]}...HEAD`];
  for (let index = 0; index < versions.length; index += 1) {
    const version = versions[index];
    const previous = versions[index + 1];
    links.push(previous
      ? `[v${version}]: ${repositoryUrl}/compare/v${previous}...v${version}`
      : `[v${version}]: ${repositoryUrl}/releases/tag/v${version}`);
  }
  return links.join("\n");
}

export function prepareRelease(root, nextVersion, date) {
  const version = parseVersion(nextVersion).raw;
  if (!isRealDate(date)) throw new Error(`发布日期无效：${date}`);
  const manifest = readPackage(root);
  const currentVersion = parseVersion(manifest.version).raw;
  if (compareVersions(version, currentVersion) <= 0) throw new Error(`新版本必须高于当前版本 ${currentVersion}`);
  const original = readFileSync(changelogPath(root), "utf8");
  const parsed = parseChangelog(original);
  if (!parsed.unreleased.content) throw new Error("Unreleased 段落为空，不能创建空发布");
  if (parsed.releases.some((section) => section.version === version)) throw new Error(`版本 ${version} 已存在于 CHANGELOG.md`);

  const before = parsed.source.slice(0, parsed.unreleased.start);
  const after = parsed.source.slice(parsed.unreleased.end).trimStart();
  const releaseBody = parsed.unreleased.content;
  const versions = [version, ...parsed.releases.map((section) => section.version)];
  const updatedChangelog = `${before}## Unreleased\n\n## v${version} — ${date}\n\n${releaseBody}\n\n${after}`.trimEnd();
  writeFileSync(changelogPath(root), `${updatedChangelog}\n\n${versionLinks(versions)}\n`);
  writeFileSync(packagePath(root), `${JSON.stringify({ ...manifest, version }, null, 2)}\n`);
  return assertReleaseContract(root);
}

export function releaseNotes(root = repoRoot, version = "") {
  const changelog = parseChangelog(readFileSync(changelogPath(root), "utf8"));
  const release = changelog.releases.find((section) => section.version === version);
  if (!release) throw new Error(`CHANGELOG.md 中找不到版本 ${version}`);
  return release.content;
}

export function releaseWorktreeIssues(status) {
  const lines = status.replace(/\s+$/u, "").split("\n").filter(Boolean);
  return lines.filter((line) => line.slice(3) !== "next-env.d.ts");
}

function assertReleaseWorktree(root = repoRoot) {
  const status = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
  const unexpected = releaseWorktreeIssues(status);
  if (unexpected.length) throw new Error(`发布操作要求干净工作树（仅允许生成的 next-env.d.ts）：${unexpected.join(", ")}`);
}

function option(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return "";
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} 需要一个值`);
  return value;
}

function main() {
  const [command, ...rawArgs] = process.argv.slice(2);
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  if (command === "check") {
    const tag = option(args, "--tag");
    assertReleaseContract(repoRoot, tag);
    console.log(`Release version contract passed for v${readPackage(repoRoot).version}.`);
    return;
  }
  if (command === "clean") {
    assertReleaseWorktree(repoRoot);
    console.log("Release worktree is clean.");
    return;
  }
  if (command === "prepare") {
    const version = args[0];
    if (!version || args.length !== 1) throw new Error("用法：release-version.mjs prepare X.Y.Z");
    assertReleaseWorktree(repoRoot);
    const result = prepareRelease(repoRoot, version, new Date().toISOString().slice(0, 10));
    console.log(`Prepared v${result.version}. Review and commit package.json plus CHANGELOG.md before tagging.`);
    return;
  }
  if (command === "notes") {
    const version = option(args, "--version");
    const output = option(args, "--output");
    if (!version || !output) throw new Error("用法：release-version.mjs notes --version X.Y.Z --output <file>");
    const notes = releaseNotes(repoRoot, parseVersion(version).raw);
    writeFileSync(resolve(repoRoot, output), `${notes}\n`);
    console.log(`Wrote release notes for v${version}.`);
    return;
  }
  throw new Error("用法：release-version.mjs <check|clean|prepare|notes>");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
