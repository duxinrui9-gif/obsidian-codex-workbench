#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseDocument } from "yaml";

const args = process.argv.slice(2);
const valueFor = (flag) => args.find((item) => item.startsWith(`${flag}=`))?.slice(flag.length + 1);
const configuredRoot = valueFor("--vault") ?? process.env.OBSIDIAN_VAULT_PATH;
const maxFiles = Number(valueFor("--max-files") ?? 5000);

if (!configuredRoot || !Number.isInteger(maxFiles) || maxFiles < 1) {
  console.error("Usage: pnpm vault:inspect -- --vault=/absolute/path/to/vault [--max-files=5000]");
  process.exit(2);
}

const root = await fs.realpath(configuredRoot);
if (!(await fs.stat(root)).isDirectory()) throw new Error("Vault path is not a directory.");
const result = { markdownFiles: 0, truncated: false, skippedSymlinks: 0, unreadableFiles: 0, withoutFrontmatter: 0, invalidFrontmatter: 0, topLevelDirectories: {}, frontmatterKeys: {} };
const increment = (target, key) => { target[key] = (target[key] ?? 0) + 1; };

async function inspect(file) {
  if (result.markdownFiles >= maxFiles) { result.truncated = true; return; }
  result.markdownFiles += 1;
  const relative = path.relative(root, file).split(path.sep).join("/");
  increment(result.topLevelDirectories, relative.split("/")[0] ?? ".");
  let raw;
  try { raw = await fs.readFile(file, "utf8"); } catch { result.unreadableFiles += 1; return; }
  if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) { result.withoutFrontmatter += 1; return; }
  const afterOpening = raw.replace(/^---\r?\n/, "");
  const closing = afterOpening.match(/^---\s*$/m);
  if (!closing || closing.index === 0) { result.invalidFrontmatter += 1; return; }
  const frontmatter = afterOpening.slice(0, closing.index);
  if (parseDocument(frontmatter).errors.length) { result.invalidFrontmatter += 1; return; }
  for (const line of frontmatter.split(/\r?\n/)) {
    const match = line.match(/^\s*([^:#][^:]*?):(?:\s|$)/);
    if (match) increment(result.frontmatterKeys, match[1].trim());
  }
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) { result.skippedSymlinks += 1; continue; }
    if (entry.isDirectory()) await walk(file);
    else if (entry.isFile() && entry.name.endsWith(".md")) await inspect(file);
    if (result.truncated) return;
  }
}

await walk(root);
result.topLevelDirectories = Object.fromEntries(Object.entries(result.topLevelDirectories).sort(([a], [b]) => a.localeCompare(b)));
result.frontmatterKeys = Object.fromEntries(Object.entries(result.frontmatterKeys).sort(([a], [b]) => a.localeCompare(b)));
console.log(JSON.stringify(result, null, 2));
