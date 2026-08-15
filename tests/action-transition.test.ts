import { describe, expect, it } from "vitest";
import { buildTransitionInput } from "../lib/action-transition";
import type { ActionRecord } from "../lib/types";

function action(overrides: Partial<ActionRecord> = {}): ActionRecord {
  return {
    id: "ACT-20260814-001", title: "测试事项", relativePath: "05_Review/Actions/ACT-20260814-001 测试事项.md", version: "version", status: "active", actionState: "in_progress", actionArea: "project", created: "2026-08-14", updated: "2026-08-14", lastActivity: "2026-08-14", startOn: "", dueOn: "", scheduledFor: "", reviewOn: "", closedAt: "", assetScope: "project", sensitivity: "restricted", evidenceStatus: "inferred", projects: [], workstreams: [], nextAction: "下一步", completionStandard: "完成", carryoverCount: 0, sourceNotes: [], sourceThreads: [], completionEvidence: [], closedReason: "", body: "", ...overrides,
  };
}

describe("transition payload builder", () => {
  it("requires a wait note and review date before constructing a wait payload", () => {
    expect(buildTransitionInput(action(), "wait", "")).toMatchObject({ ok: false, field: "note" });
    expect(buildTransitionInput(action(), "wait", "等待反馈")).toMatchObject({ ok: false, field: "reviewOn" });
    expect(buildTransitionInput(action({ reviewOn: "2026-08-15" }), "wait", "等待反馈")).toEqual({ ok: true, payload: { expectedVersion: "version", transition: "wait", note: "等待反馈", reviewOn: "2026-08-15" } });
  });

  it("requires notes for completion and cancellation", () => {
    expect(buildTransitionInput(action(), "complete", "")).toMatchObject({ ok: false, field: "note" });
    expect(buildTransitionInput(action(), "cancel", "")).toMatchObject({ ok: false, field: "note" });
    expect(buildTransitionInput(action(), "complete", "已交付结果")).toEqual({ ok: true, payload: { expectedVersion: "version", transition: "complete", note: "已交付结果" } });
  });

  it("uses the single draft scheduled date for scheduling and carryover", () => {
    expect(buildTransitionInput(action(), "schedule", "")).toMatchObject({ ok: false, field: "scheduledFor" });
    expect(buildTransitionInput(action({ scheduledFor: "2026-08-16" }), "schedule", "安排本周处理")).toEqual({ ok: true, payload: { expectedVersion: "version", transition: "schedule", note: "安排本周处理", scheduledFor: "2026-08-16" } });
    expect(buildTransitionInput(action(), "carryover", "")).toEqual({ ok: true, payload: { expectedVersion: "version", transition: "carryover", note: undefined, scheduledFor: undefined } });
  });
});
