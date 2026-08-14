import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const run = promisify(execFile);
const fixture = path.join(process.cwd(), "tests", "fixtures", "vault");
let vault = "";

beforeEach(async () => { vault = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-vault-inspect-")); await fs.cp(fixture, vault, { recursive: true }); });
afterEach(async () => { await fs.rm(vault, { recursive: true, force: true }); });

describe("Vault inspector", () => {
  it("reports structure and keys without leaking note bodies or absolute paths", async () => {
    const { stdout } = await run(process.execPath, ["scripts/inspect-vault.mjs", `--vault=${vault}`], { cwd: process.cwd() });
    expect(stdout).not.toContain(vault);
    expect(stdout).not.toContain("测试夹具。");
    expect(JSON.parse(stdout)).toMatchObject({ markdownFiles: 5, truncated: false, frontmatterKeys: { action_id: 1 } });
  });

  it("reports malformed frontmatter and bounded scans", async () => {
    await fs.writeFile(path.join(vault, "坏文件.md"), "---\nstatus: [\n---\n正文\n");
    const { stdout } = await run(process.execPath, ["scripts/inspect-vault.mjs", `--vault=${vault}`, "--max-files=1"], { cwd: process.cwd() });
    expect(JSON.parse(stdout)).toMatchObject({ markdownFiles: 1, truncated: true });
    const complete = await run(process.execPath, ["scripts/inspect-vault.mjs", `--vault=${vault}`], { cwd: process.cwd() });
    expect(JSON.parse(complete.stdout).invalidFrontmatter).toBe(1);
  });
});
