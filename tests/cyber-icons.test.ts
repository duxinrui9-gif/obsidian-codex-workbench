import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const icons = [
  "add", "brand-core", "carryover", "close", "dismiss", "external-link", "nav-command", "nav-daily", "nav-monthly", "nav-projects", "nav-tasks", "nav-weekly", "next-action", "overdue", "project-radar", "refresh", "review-plan", "review-report", "risk-watch", "save", "schedule", "state-backlog", "state-cancelled", "state-done", "state-in-progress", "state-ready", "state-review", "state-waiting", "theme-dark", "theme-light", "vault-disconnected", "vault-linked",
];

describe("cyber icon assets", () => {
  it("ships all 32 normalized RGBA PNG masks", async () => {
    await Promise.all(icons.map(async (name) => {
      const image = await readFile(path.join(process.cwd(), "public/icons/cyber", `${name}.png`));
      expect(image.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(image.readUInt32BE(16)).toBe(128);
      expect(image.readUInt32BE(20)).toBe(128);
      expect(image[25]).toBe(6);
    }));
  });
});
