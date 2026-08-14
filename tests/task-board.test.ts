import { describe, expect, it } from "vitest";
import { groupArchivedActions, sortProjectActions, taskDateEntries } from "../lib/task-board";
import type { ActionRecord } from "../lib/types";

function action(overrides: Partial<ActionRecord>): ActionRecord {
  return {
    id: "ACT-20260814-001", title: "测试事项", relativePath: "90_System/行动/ACT-20260814-001.md", version: "version", status: "active", actionState: "ready", actionArea: "project", created: "2026-08-14", updated: "2026-08-14T10:00:00Z", lastActivity: "2026-08-14", scheduledFor: "", reviewOn: "", closedAt: "", assetScope: "project", sensitivity: "internal", evidenceStatus: "observed", projects: [], workstreams: [], nextAction: "下一步", completionStandard: "完成", carryoverCount: 0, sourceNotes: [], sourceThreads: [], completionEvidence: [], closedReason: "", body: "", ...overrides,
  };
}

describe("task board helpers", () => {
  it("buckets scheduled and review dates independently and excludes undated actions", () => {
    const dated = action({ id: "both", scheduledFor: "2026-08-15", reviewOn: "2026-08-17" });
    expect(taskDateEntries([action({ id: "none" }), dated])).toEqual([
      { action: dated, date: "2026-08-15", kind: "scheduled" },
      { action: dated, date: "2026-08-17", kind: "review" },
    ]);
  });

  it("puts running project work first before updated order", () => {
    const running = action({ id: "running", actionState: "in_progress", updated: "2026-08-13T01:00:00Z" });
    const recent = action({ id: "recent", updated: "2026-08-15T01:00:00Z" });
    const older = action({ id: "older", updated: "2026-08-12T01:00:00Z" });
    expect(sortProjectActions([older, recent, running]).map((item) => item.id)).toEqual(["running", "recent", "older"]);
  });

  it("groups archived work by project and keeps cancelled work separate", () => {
    const doneOld = action({ id: "done-old", status: "archived", actionState: "done", closedAt: "2026-08-10", projects: ["[[03_Topics/项目/项目甲]]"] });
    const doneNew = action({ id: "done-new", status: "archived", actionState: "done", closedAt: "2026-08-12", projects: ["[[03_Topics/项目/项目甲]]"] });
    const cancelled = action({ id: "cancelled", status: "archived", actionState: "cancelled", closedAt: "2026-08-13", projects: ["[[项目甲]]"] });
    const unassigned = action({ id: "unassigned", status: "archived", actionState: "done", closedAt: "2026-08-14" });
    const groups = groupArchivedActions([doneOld, cancelled, unassigned, doneNew]);
    expect(groups.find((group) => group.project === "项目甲")).toMatchObject({ done: [{ id: "done-new" }, { id: "done-old" }], cancelled: [{ id: "cancelled" }] });
    expect(groups.find((group) => group.project === "未归类")?.done).toMatchObject([{ id: "unassigned" }]);
  });
});
