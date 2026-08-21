import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const vault = path.resolve("tests/fixtures/e2e-vault");

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:3111", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm exec next start --hostname 127.0.0.1 --port 3111",
    url: "http://127.0.0.1:3111",
    reuseExistingServer: false,
    env: { ...process.env, OBSIDIAN_VAULT_PATH: vault, WORKBENCH_WRITE_ENABLED: "false", WORKBENCH_TIME_ZONE: "Asia/Hong_Kong", NEXT_PUBLIC_WORKBENCH_TIME_ZONE: "Asia/Hong_Kong" },
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
