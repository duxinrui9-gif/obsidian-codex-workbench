import { AppError } from "@/lib/errors";
import type { ActionState, ProjectStatus, ReviewPeriod } from "@/lib/types";

const DEFAULT_TIME_ZONE = "Asia/Hong_Kong";

function relative(value: string | undefined, fallback: string, label: string): string {
  const next = (value ?? fallback).trim().replaceAll("\\", "/");
  if (!next || next.startsWith("/") || /^[A-Za-z]:\//.test(next) || next.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new AppError(`${label}必须是 Vault 内的相对目录。`, 422, "INVALID_VAULT_PROFILE");
  }
  return next;
}

function configuredTimeZone(value = process.env.WORKBENCH_TIME_ZONE ?? process.env.NEXT_PUBLIC_WORKBENCH_TIME_ZONE ?? DEFAULT_TIME_ZONE): string {
  try { new Intl.DateTimeFormat("en-CA", { timeZone: value }).format(); return value; } catch { throw new AppError("WORKBENCH_TIME_ZONE 不是有效时区。", 422, "INVALID_VAULT_PROFILE"); }
}

export const clientTimeZone = process.env.NEXT_PUBLIC_WORKBENCH_TIME_ZONE ?? DEFAULT_TIME_ZONE;

export interface VaultProfile {
  timeZone: string;
  paths: { actions: string; projects: string; projectTemplate: string; reviews: Record<ReviewPeriod, string> };
  properties: {
    action: Record<"id" | "state" | "status" | "area" | "created" | "updated" | "lastActivity" | "startOn" | "dueOn" | "scheduledFor" | "reviewOn" | "closedAt" | "assetScope" | "sensitivity" | "evidenceStatus" | "projects" | "workstreams" | "nextAction" | "completionStandard" | "carryoverCount" | "sourceNotes" | "sourceThreads" | "completionEvidence" | "closedReason", string>;
    project: { status: string };
    review: { kind: string; legacyKind: string; status: string; date: string; periodStart: string; periodEnd: string; projects: string; testArtifact: string };
  };
  states: { action: Record<ActionState, string>; project: Record<Exclude<ProjectStatus, "unknown">, string> };
}

export function vaultProfile(): VaultProfile {
  return {
    timeZone: configuredTimeZone(),
    paths: {
      actions: relative(process.env.WORKBENCH_ACTIONS_DIR, "05_Review/Actions", "WORKBENCH_ACTIONS_DIR"),
      projects: relative(process.env.WORKBENCH_PROJECTS_DIR, "03_Topics/项目", "WORKBENCH_PROJECTS_DIR"),
      projectTemplate: relative(process.env.WORKBENCH_PROJECT_TEMPLATE, "98_Templates/项目主页.md", "WORKBENCH_PROJECT_TEMPLATE"),
      reviews: {
        daily: relative(process.env.WORKBENCH_DAILY_DIR, "05_Review/Daily", "WORKBENCH_DAILY_DIR"),
        weekly: relative(process.env.WORKBENCH_WEEKLY_DIR, "05_Review/Weekly", "WORKBENCH_WEEKLY_DIR"),
        monthly: relative(process.env.WORKBENCH_MONTHLY_DIR, "05_Review/Monthly", "WORKBENCH_MONTHLY_DIR"),
      },
    },
    properties: {
      action: { id: "action_id", state: "action_state", status: "status", area: "action_area", created: "created", updated: "updated", lastActivity: "last_activity", startOn: "start_on", dueOn: "due_on", scheduledFor: "scheduled_for", reviewOn: "review_on", closedAt: "closed_at", assetScope: "asset_scope", sensitivity: "sensitivity", evidenceStatus: "evidence_status", projects: "projects", workstreams: "workstreams", nextAction: "next_action", completionStandard: "completion_standard", carryoverCount: "carryover_count", sourceNotes: "source_notes", sourceThreads: "source_threads", completionEvidence: "completion_evidence", closedReason: "closed_reason" },
      project: { status: "status" },
      review: { kind: "daily_kind", legacyKind: "review_kind", status: "status", date: "date", periodStart: "period_start", periodEnd: "period_end", projects: "projects", testArtifact: "test_artifact" },
    },
    states: {
      action: { ready: "ready", in_progress: "in_progress", waiting: "waiting", backlog: "backlog", review: "review", done: "done", cancelled: "cancelled" },
      project: { active: "active", review: "review", archived: "archived", ignored: "ignored" },
    },
  };
}

export function actionStateFromSource(value: string): ActionState | null { return (Object.entries(vaultProfile().states.action) as Array<[ActionState, string]>).find(([, source]) => source === value)?.[0] ?? null; }
export function actionStateToSource(value: ActionState): string { return vaultProfile().states.action[value]; }
export function projectStatusFromSource(value: string): ProjectStatus { return (Object.entries(vaultProfile().states.project) as Array<[Exclude<ProjectStatus, "unknown">, string]>).find(([, source]) => source === value)?.[0] ?? "unknown"; }
export function projectStatusToSource(value: Exclude<ProjectStatus, "unknown">): string { return vaultProfile().states.project[value]; }
/**
 * Writes are opt-in. A missing or malformed environment variable must never
 * turn a newly cloned public checkout into a writable Vault client.
 */
export function workbenchWriteEnabled(): boolean { return process.env.WORKBENCH_WRITE_ENABLED === "true"; }
