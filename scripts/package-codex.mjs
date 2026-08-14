#!/usr/bin/env node
import { spawnSync } from "node:child_process";

// Compatibility entry point for earlier local workflows. Public releases are
// now built by the unified release script rather than the former private ZIP.
console.warn("package:codex is retained for compatibility; using the public release builder.");
const result = spawnSync("bash", ["scripts/build-release.sh", ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
