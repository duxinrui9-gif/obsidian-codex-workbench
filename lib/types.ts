export const ACTION_STATES = [
  "ready",
  "in_progress",
  "waiting",
  "backlog",
  "review",
  "done",
  "cancelled",
] as const;

export type ActionState = (typeof ACTION_STATES)[number];
export type ActionArea = "project" | "personal" | "knowledge" | "candidate";
export type AssetScope = "personal" | "organization" | "project" | "brand";
export type ReviewPeriod = "daily" | "weekly" | "monthly";
export type ReviewKind = "plan" | "report";
export type ProjectStatus = "active" | "review" | "archived" | "ignored" | "unknown";
export type VaultIssueKind = "action" | "project" | "review";

export interface VaultIssue {
  kind: VaultIssueKind;
  relativePath: string;
  code: string;
  message: string;
}

export interface ActionRecord {
  id: string;
  title: string;
  relativePath: string;
  version: string;
  status: "active" | "archived";
  actionState: ActionState;
  actionArea: ActionArea;
  created: string;
  updated: string;
  lastActivity: string;
  scheduledFor: string;
  reviewOn: string;
  closedAt: string;
  assetScope: AssetScope;
  sensitivity: string;
  evidenceStatus: string;
  projects: string[];
  workstreams: string[];
  nextAction: string;
  completionStandard: string;
  carryoverCount: number;
  sourceNotes: string[];
  sourceThreads: string[];
  completionEvidence: string[];
  closedReason: string;
  body: string;
}

export interface ProjectSummary {
  name: string;
  wikiLink: string;
  relativePath: string;
  status: ProjectStatus;
  hasProjectPage: boolean;
  activeCount: number;
  overdueCount: number;
  waitingCount: number;
  inProgressCount: number;
  tasks: ActionRecord[];
  doneTasks: ActionRecord[];
  cancelledTasks: ActionRecord[];
  doneCount: number;
  cancelledCount: number;
}

export interface ReviewRecord {
  id: string;
  relativePath: string;
  title: string;
  version: string;
  period: ReviewPeriod;
  kind: ReviewKind;
  status: string;
  date: string;
  periodStart: string;
  periodEnd: string;
  projects: string[];
  isLegacy: boolean;
  body?: string;
}

export interface HealthResponse {
  ok: boolean;
  scannedAt: string;
  vaultName: string;
  actionCount: number;
  reviewCount: number;
  projectCount: number;
  message: string;
  issues: VaultIssue[];
}

export interface WorkbenchSnapshot {
  actions: ActionRecord[];
  projects: ProjectSummary[];
  issues: VaultIssue[];
  vaultName: string;
  scannedAt: string;
  actionCount: number;
  projectCount: number;
  capabilities: { writeEnabled: boolean };
}

export interface ReviewIndexResponse {
  reviews: ReviewRecord[];
  issues: VaultIssue[];
}

export interface CreateActionInput {
  title: string;
  actionArea: ActionArea;
  project?: string;
  workstreams?: string[];
  nextAction: string;
  completionStandard: string;
  scheduledFor?: string;
  assetScope?: AssetScope;
}

export interface CreateProjectInput {
  name: string;
  goal: string;
  successCriteria: string;
  nextAction: string;
  targetDate?: string;
}

export interface ActionPatch {
  expectedVersion: string;
  actionArea?: ActionArea;
  projects?: string[];
  workstreams?: string[];
  nextAction?: string;
  completionStandard?: string;
  scheduledFor?: string;
  reviewOn?: string;
  assetScope?: AssetScope;
}

export interface TransitionInput {
  expectedVersion: string;
  transition: "start" | "wait" | "schedule" | "carryover" | "complete" | "cancel";
  note?: string;
  reviewOn?: string;
  scheduledFor?: string;
}
