import { describe, expect, it } from "vitest";
import { deliverySignals, groupArchivedActions, sortProjectActions, taskDateEntries, taskDateSummary } from "../lib/task-board";
import type { ActionRecord } from "../lib/types";

function action(overrides: Partial<ActionRecord>): ActionRecord {
  return {
    id: "ACT-20260814-001", title: "测试事项", relativePath: "90_System/行动/ACT-20260814-001.md", version: "version", status: "active", actionState: "ready", actionArea: "project", created: "2026-08-14", updated: "2026-08-14T10:00:00Z", lastActivity: "2026-08-14", startOn: "", dueOn: "", scheduledFor: "", reviewOn: "", closedAt: "", assetScope: "project", sensitivity: "internal", evidenceStatus: "observed", projects: [], workstreams: [], nextAction: "下一步", completionStandard: "完成", carryoverCount: 0, sourceNotes: [], sourceThreads: [], completionEvidence: [], closedReason: "", body: "", ...overrides,
  };
}

describe("task board helpers", () => {
  it("buckets all delivery-window dates independently and excludes undated actions", () => {
    const dated = action({ id: "both", startOn: "2026-08-15", scheduledFor: "2026-08-15", dueOn: "2026-08-16", reviewOn: "2026-08-17" });
    expect(taskDateEntries([action({ id: "none" }), dated])).toEqual([
      { action: dated, date: "2026-08-15", kind: "start" },
      { action: dated, date: "2026-08-15", kind: "scheduled" },
      { action: dated, date: "2026-08-16", kind: "due" },
      { action: dated, date: "2026-08-17", kind: "review" },
    ]);
  });

  it("puts running project work first and then uses the nearest delivery date", () => {
    const running = action({ id: "running", actionState: "in_progress", updated: "2026-08-13T01:00:00Z", dueOn: "2026-08-30" });
    const urgent = action({ id: "urgent", updated: "2026-08-12T01:00:00Z", dueOn: "2026-08-16" });
    const recent = action({ id: "recent", updated: "2026-08-15T01:00:00Z" });
    const older = action({ id: "older", updated: "2026-08-12T01:00:00Z" });
    expect(sortProjectActions([older, recent, urgent, running]).map((item) => item.id)).toEqual(["running", "urgent", "recent", "older"]);
  });

  it("separates today starts, due dates, and overdue deliveries without changing task state", () => {
    const startsToday = action({ id: "start", startOn: "2026-08-15", actionState: "backlog" });
    const dueToday = action({ id: "due", dueOn: "2026-08-15" });
    const overdue = action({ id: "overdue", dueOn: "2026-08-14" });
    const closed = action({ id: "closed", status: "archived", actionState: "done", dueOn: "2026-08-14" });
    expect(deliverySignals([startsToday, dueToday, overdue, closed], "2026-08-15")).toMatchObject({ startsToday: [{ id: "start" }], dueToday: [{ id: "due" }], overdueDelivery: [{ id: "overdue" }] });
    expect(taskDateSummary(action({ startOn: "2026-08-15", dueOn: "2026-08-18" }))).toBe("始 08-15 · 交 08-18");
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
