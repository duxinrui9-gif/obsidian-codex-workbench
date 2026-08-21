import { describe, expect, it } from "vitest";
import { deliverySignals, groupArchivedActions, groupTaskDateEntries, preferredTaskCalendarDate, sortProjectActions, taskDateEntries, taskDateSummary } from "../lib/task-board";
import type { ActionRecord } from "../lib/types";

function action(overrides: Partial<ActionRecord>): ActionRecord {
  return {
    id: "ACT-20260814-001", title: "测试事项", relativePath: "90_System/行动/ACT-20260814-001.md", version: "version", status: "active", actionState: "ready", actionArea: "project", created: "2026-08-14", updated: "2026-08-14T10:00:00Z", lastActivity: "2026-08-14", startOn: "", dueOn: "", scheduledFor: "", reviewOn: "", closedAt: "", assetScope: "project", sensitivity: "internal", evidenceStatus: "observed", projects: [], workstreams: [], nextAction: "下一步", completionStandard: "完成", carryoverCount: 0, sourceNotes: [], sourceThreads: [], completionEvidence: [], closedReason: "", body: "", ...overrides,
  };
}

describe("task board helpers", () => {
  it("expands delivery windows and merges every date role for the same task", () => {
    const dated = action({ id: "both", startOn: "2026-08-15", scheduledFor: "2026-08-15", dueOn: "2026-08-17", reviewOn: "2026-08-18" });
    expect(taskDateEntries([action({ id: "none" }), dated], ["2026-08-15", "2026-08-16", "2026-08-17", "2026-08-18"])).toEqual([
      { action: dated, date: "2026-08-15", kinds: ["start", "scheduled"] },
      { action: dated, date: "2026-08-16", kinds: ["window"] },
      { action: dated, date: "2026-08-17", kinds: ["due"] },
      { action: dated, date: "2026-08-18", kinds: ["review"] },
    ]);
  });

  it("keeps one-sided dates and out-of-window execution dates without inventing a range", () => {
    const startOnly = action({ id: "start", startOn: "2026-08-30" });
    const dueOnly = action({ id: "due", dueOn: "2026-09-02" });
    const crossMonth = action({ id: "cross", startOn: "2026-08-30", dueOn: "2026-09-02", scheduledFor: "2026-09-04" });
    expect(taskDateEntries([startOnly, dueOnly, crossMonth], ["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-04"])).toMatchObject([
      { action: startOnly, date: "2026-08-30", kinds: ["start"] },
      { action: crossMonth, date: "2026-08-30", kinds: ["start"] },
      { action: crossMonth, date: "2026-08-31", kinds: ["window"] },
      { action: crossMonth, date: "2026-09-01", kinds: ["window"] },
      { action: dueOnly, date: "2026-09-02", kinds: ["due"] },
      { action: crossMonth, date: "2026-09-02", kinds: ["due"] },
      { action: crossMonth, date: "2026-09-04", kinds: ["scheduled"] },
    ]);
  });

  it("sorts busy-day project groups by urgency and keeps each task unique", () => {
    const due = action({ id: "due", dueOn: "2026-08-18", projects: ["[[项目乙]]"] });
    const running = action({ id: "running", actionState: "in_progress", scheduledFor: "2026-08-18", projects: ["[[项目甲]]"] });
    const scheduled = action({ id: "scheduled", scheduledFor: "2026-08-18", projects: ["[[项目甲]]"] });
    const entries = taskDateEntries([scheduled, running, due], ["2026-08-18"]);
    expect(groupTaskDateEntries(entries, "2026-08-18").map((group) => ({ project: group.project, ids: group.entries.map((entry) => entry.action.id) }))).toEqual([
      { project: "项目乙", ids: ["due"] },
      { project: "项目甲", ids: ["running", "scheduled"] },
    ]);
  });

  it("prefers today, otherwise the nearest future date, while preserving a valid selection", () => {
    expect(preferredTaskCalendarDate(["2026-08-10", "2026-08-17"], "2026-08-15")).toBe("2026-08-17");
    expect(preferredTaskCalendarDate(["2026-08-15", "2026-08-17"], "2026-08-15")).toBe("2026-08-15");
    expect(preferredTaskCalendarDate(["2026-08-15", "2026-08-17"], "2026-08-15", "2026-08-17")).toBe("2026-08-17");
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
