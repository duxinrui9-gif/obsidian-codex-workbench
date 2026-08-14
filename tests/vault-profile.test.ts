import { afterEach, describe, expect, it } from "vitest";
import { AppError } from "../lib/errors";
import { assertWriteEnabled } from "../lib/security";
import { actionStateFromSource, actionStateToSource, projectStatusFromSource, vaultProfile, workbenchWriteEnabled } from "../lib/vault-profile";

const PROFILE_ENV = ["WORKBENCH_WRITE_ENABLED", "WORKBENCH_TIME_ZONE", "NEXT_PUBLIC_WORKBENCH_TIME_ZONE", "WORKBENCH_ACTIONS_DIR", "WORKBENCH_PROJECTS_DIR", "WORKBENCH_PROJECT_TEMPLATE", "WORKBENCH_DAILY_DIR", "WORKBENCH_WEEKLY_DIR", "WORKBENCH_MONTHLY_DIR"] as const;
const saved = new Map(PROFILE_ENV.map((key) => [key, process.env[key]]));

afterEach(() => { for (const key of PROFILE_ENV) { const value = saved.get(key); if (value === undefined) delete process.env[key]; else process.env[key] = value; } });

describe("Vault profile", () => {
  it("uses the bundled paths and normalized state mappings by default", () => {
    const profile = vaultProfile();
    expect(profile.paths.actions).toBe("05_Review/Actions");
    expect(profile.paths.projects).toBe("03_Topics/项目");
    expect(actionStateFromSource("in_progress")).toBe("in_progress");
    expect(actionStateToSource("done")).toBe("done");
    expect(projectStatusFromSource("archived")).toBe("archived");
  });

  it("rejects unsafe paths and invalid time zones", () => {
    process.env.WORKBENCH_ACTIONS_DIR = "../Actions";
    expect(() => vaultProfile()).toThrow(AppError);
    process.env.WORKBENCH_ACTIONS_DIR = "Actions";
    process.env.WORKBENCH_TIME_ZONE = "Mars/Olympus";
    expect(() => vaultProfile()).toThrow(AppError);
  });

  it("honors the package read-only flag before allowing writes", () => {
    delete process.env.WORKBENCH_WRITE_ENABLED;
    expect(workbenchWriteEnabled()).toBe(false);
    process.env.WORKBENCH_WRITE_ENABLED = "false";
    expect(() => assertWriteEnabled()).toThrow(/只读接入模式/);
    process.env.WORKBENCH_WRITE_ENABLED = "unexpected";
    expect(() => assertWriteEnabled()).toThrow(/只读接入模式/);
    process.env.WORKBENCH_WRITE_ENABLED = "true";
    expect(() => assertWriteEnabled()).not.toThrow();
  });
});
