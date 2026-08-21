import { describe, expect, it } from "vitest";
import { obsidianOpenUri } from "../lib/obsidian-uri";
import { reviewHeadingId, visibleReviewBody } from "../lib/review-utils";
import { rovingTabIndex } from "../lib/roving-tabs";
import { filterTaskBoardActions } from "../lib/task-board";
import type { ActionRecord, ReviewRecord } from "../lib/types";

function action(overrides: Partial<ActionRecord> = {}): ActionRecord {
  return { id: "ACT-001", title: "测试任务", status: "active", actionState: "ready", actionArea: "personal", created: "2026-08-20", updated: "2026-08-20", lastActivity: "2026-08-20", startOn: "", dueOn: "", scheduledFor: "", reviewOn: "", closedAt: "", assetScope: "personal", sensitivity: "restricted", evidenceStatus: "observed", projects: [], workstreams: [], nextAction: "下一步", completionStandard: "标准", carryoverCount: 0, sourceNotes: [], sourceThreads: [], completionEvidence: [], closedReason: "", body: "", relativePath: "05_Review/Actions/测试.md", version: "v1", ...overrides };
}

describe("workbench UI helpers", () => {
  it("filters risk tiles without changing the source set", () => {
    const items = [action({ id: "review", actionState: "review" }), action({ id: "wait", actionState: "waiting", reviewOn: "2026-08-19" }), action({ id: "backlog", actionState: "backlog" })];
    expect(filterTaskBoardActions(items, "overdue_review", "2026-08-20").map((item) => item.id)).toEqual(["wait"]);
    expect(filterTaskBoardActions(items, "review", "2026-08-20").map((item) => item.id)).toEqual(["review"]);
  });

  it("uses cyclic roving indexes", () => {
    expect(rovingTabIndex(0, "ArrowLeft", 3)).toBe(2);
    expect(rovingTabIndex(1, "Home", 3)).toBe(0);
    expect(rovingTabIndex(1, "End", 3)).toBe(2);
    expect(rovingTabIndex(1, "Enter", 3)).toBeNull();
  });

  it("removes a leading duplicate H1 even after blank lines", () => {
    const review = { title: "日报", id: "r", kind: "report" } as ReviewRecord;
    expect(visibleReviewBody(review, "\n\n# 日报\n\n## 结论\n正文")).toBe("## 结论\n正文");
    expect(reviewHeadingId("今日结论")).toBe("review-section-今日结论");
  });

  it("builds vault plus relative file Obsidian URIs", () => {
    expect(obsidianOpenUri("测试 Vault", "03_Topics/人物/测试.md")).toBe("obsidian://open?vault=%E6%B5%8B%E8%AF%95%20Vault&file=03_Topics%2F%E4%BA%BA%E7%89%A9%2F%E6%B5%8B%E8%AF%95.md");
  });
});
