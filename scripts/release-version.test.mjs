import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { assertReleaseContract, compareVersions, parseChangelog, parseVersion, prepareRelease, releaseNotes, releaseWorktreeIssues } from "./release-version.mjs";

function fixture(changelog = "# Changelog\n\n## Unreleased\n\n- Add calendar filtering.\n\n## v0.1.0 — 2026-08-14\n\n- First release.\n") {
  const root = mkdtempSync(join(tmpdir(), "workbench-release-"));
  writeFileSync(join(root, "package.json"), `${JSON.stringify({ name: "fixture", version: "0.1.0", private: true }, null, 2)}\n`);
  writeFileSync(join(root, "CHANGELOG.md"), changelog);
  return root;
}

function dispose(root) { rmSync(root, { recursive: true, force: true }); }

test("accepts stable SemVer and orders versions", () => {
  assert.equal(parseVersion("0.2.0").raw, "0.2.0");
  assert.equal(compareVersions("0.2.0", "0.1.9"), 1);
  assert.throws(() => parseVersion("v0.2.0"));
  assert.throws(() => parseVersion("0.2.0-beta.1"));
});

test("allows only the generated Next route reference in a release worktree", () => {
  assert.deepEqual(releaseWorktreeIssues(" M next-env.d.ts\n"), []);
  assert.deepEqual(releaseWorktreeIssues(" M package.json\n M next-env.d.ts\n"), [" M package.json"]);
});

test("rejects inconsistent version contracts and malformed changelogs", () => {
  const root = fixture();
  try {
    assert.throws(() => assertReleaseContract(root, "v0.2.1"), /不一致/);
    assert.throws(() => parseChangelog("# Changelog\n\n## Unreleased\n\n## Unreleased\n"), /只能包含一个/);
    assert.throws(() => parseChangelog("# Changelog\n\n## Unreleased\n\n## v0.1.0 — 2026-02-31\n\n- Invalid.\n"), /发布日期无效/);
  } finally { dispose(root); }
});

test("freezes Unreleased content, rewrites links, and extracts notes", () => {
  const root = fixture();
  try {
    const result = prepareRelease(root, "0.2.0", "2026-08-21");
    assert.equal(result.version, "0.2.0");
    const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
    assert.match(changelog, /## Unreleased\n\n## v0\.2\.0 — 2026-08-21/);
    assert.match(changelog, /\[v0\.2\.0\]: .*v0\.1\.0\.\.\.v0\.2\.0/);
    assert.equal(releaseNotes(root, "0.2.0"), "- Add calendar filtering.");
    assert.equal(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version, "0.2.0");
    assert.throws(() => prepareRelease(root, "0.2.0", "2026-08-21"), /高于当前版本/);
  } finally { dispose(root); }
});
