import { describe, expect, it } from "vitest";
import { EMPTY_PROJECT_FILTERS, EMPTY_TASK_FILTERS, filterProjects, filterTaskActions, sortProjectsForBoard } from "../lib/board-filters";
import type { ActionRecord, ProjectSummary } from "../lib/types";

function action(overrides: Partial<ActionRecord> = {}): ActionRecord {
  return { id: "ACT-001", title: "推进官网", relativePath: "05_Review/Actions/ACT-001.md", version: "v", status: "active", actionState: "ready", actionArea: "project", created: "2026-08-21", updated: "2026-08-21", lastActivity: "2026-08-21", startOn: "", dueOn: "", scheduledFor: "", reviewOn: "", closedAt: "", assetScope: "project", sensitivity: "internal", evidenceStatus: "observed", projects: ["[[03_Topics/项目/项目甲]]"], workstreams: ["官网"], nextAction: "提交首页", completionStandard: "上线", carryoverCount: 0, sourceNotes: [], sourceThreads: [], completionEvidence: [], closedReason: "", body: "", ...overrides };
}

function project(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return { id: "project-id", name: "项目甲", wikiLink: "[[03_Topics/项目/项目甲]]", relativePath: "03_Topics/项目/项目甲.md", version: "v", updated: "2026-08-21", status: "active", hasProjectPage: true, activeCount: 1, overdueCount: 0, waitingCount: 0, inProgressCount: 0, overdueDeliveryCount: 0, tasks: [], doneTasks: [], cancelledTasks: [], doneCount: 0, cancelledCount: 0, ...overrides };
}

describe("board filters", () => {
  it("combines task keyword, project, state, and date-risk filters", () => {
    const matching = action({ id: "match", actionState: "waiting", reviewOn: "2026-08-20" });
    const otherProject = action({ id: "other", title: "其他事项", projects: ["[[项目乙]]"], actionState: "waiting", reviewOn: "2026-08-20" });
    const differentState = action({ id: "state", actionState: "ready", reviewOn: "2026-08-20" });
    expect(filterTaskActions([matching, otherProject, differentState], { query: "官网", project: "项目甲", state: "waiting", date: "overdue_review" }, "2026-08-21").map((item) => item.id)).toEqual(["match"]);
    expect(filterTaskActions([action({ id: "none", projects: [] })], { ...EMPTY_TASK_FILTERS, project: "未归类", date: "undated" }, "2026-08-21").map((item) => item.id)).toEqual(["none"]);
  });

  it("filters active and archived projects using tab-specific health", () => {
    const active = project({ name: "推进项目", inProgressCount: 1 });
    const waiting = project({ name: "等待项目", waitingCount: 1 });
    const archived = project({ name: "结束项目", status: "archived", activeCount: 1, doneCount: 2 });
    expect(filterProjects([active, waiting, archived], "active", { ...EMPTY_PROJECT_FILTERS, health: "in_progress" }).map((item) => item.name)).toEqual(["推进项目"]);
    expect(filterProjects([active, waiting, archived], "archived", { ...EMPTY_PROJECT_FILTERS, health: "residual_active" }).map((item) => item.name)).toEqual(["结束项目"]);
    expect(filterProjects([active, waiting, archived], "archived", { query: "结束", health: "has_done" }).map((item) => item.name)).toEqual(["结束项目"]);
  });

  it("sorts active projects by task load and keeps source arrays unchanged", () => {
    const zero = project({ name: "零任务", activeCount: 0, inProgressCount: 0, overdueDeliveryCount: 0, updated: "2026-08-22" });
    const low = project({ name: "低负荷", activeCount: 1, inProgressCount: 1, overdueDeliveryCount: 1, updated: "2026-08-20" });
    const delivery = project({ name: "交付风险", activeCount: 3, inProgressCount: 1, overdueDeliveryCount: 2, updated: "2026-08-20" });
    const progressing = project({ name: "正在推进", activeCount: 3, inProgressCount: 2, overdueDeliveryCount: 0, updated: "2026-08-19" });
    const recent = project({ name: "最新更新", activeCount: 3, inProgressCount: 2, overdueDeliveryCount: 0, updated: "2026-08-22" });
    const original = [zero, low, delivery, progressing, recent];
    expect(sortProjectsForBoard(original, "active").map((item) => item.name)).toEqual(["最新更新", "正在推进", "交付风险", "低负荷", "零任务"]);
    expect(original.map((item) => item.name)).toEqual(["零任务", "低负荷", "交付风险", "正在推进", "最新更新"]);
  });

  it("sorts filtered projects and archived projects consistently", () => {
    const first = project({ name: "匹配项目甲", activeCount: 2, inProgressCount: 1, updated: "2026-08-21" });
    const second = project({ name: "匹配项目乙", activeCount: 4, inProgressCount: 0, updated: "2026-08-20" });
    const archivedOlder = project({ name: "结束项目甲", status: "archived", activeCount: 0, updated: "2026-08-20" });
    const archivedNewer = project({ name: "结束项目乙", status: "archived", activeCount: 0, updated: "2026-08-22" });
    expect(filterProjects([first, second], "active", { query: "匹配", health: "" }).map((item) => item.name)).toEqual(["匹配项目乙", "匹配项目甲"]);
    expect(filterProjects([archivedOlder, archivedNewer], "archived", EMPTY_PROJECT_FILTERS).map((item) => item.name)).toEqual(["结束项目乙", "结束项目甲"]);
  });
});
