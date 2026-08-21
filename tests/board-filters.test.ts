import { describe, expect, it } from "vitest";
import { EMPTY_PROJECT_FILTERS, EMPTY_TASK_FILTERS, filterProjects, filterTaskActions } from "../lib/board-filters";
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
});
