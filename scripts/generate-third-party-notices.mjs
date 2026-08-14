import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const names = [...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {})].sort();
const rows = names.map((name) => {
  const pkg = JSON.parse(readFileSync(resolve(root, "node_modules", name, "package.json"), "utf8"));
  const license = typeof pkg.license === "string" ? pkg.license : "SEE PACKAGE";
  return `| ${name} | ${pkg.version} | ${license} |`;
});
const text = [
  "# Third-party notices",
  "",
  "This inventory is generated from direct runtime and development dependencies declared in `package.json`. Transitive dependency notices remain in their own packages and lockfile.",
  "",
  "| Package | Version | License |",
  "| --- | --- | --- |",
  ...rows,
  "",
].join("\n");
writeFileSync(resolve(root, "THIRD_PARTY_NOTICES.md"), text, "utf8");
