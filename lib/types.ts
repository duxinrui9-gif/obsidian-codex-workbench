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
export type CollaboratorStatus = ProjectStatus;
export type VaultIssueKind = "action" | "project" | "review" | "collaborator";

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
  startOn: string;
  dueOn: string;
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
  id: string;
  name: string;
  wikiLink: string;
  relativePath: string;
  version: string;
  updated: string;
  status: ProjectStatus;
  hasProjectPage: boolean;
  activeCount: number;
  overdueCount: number;
  waitingCount: number;
  inProgressCount: number;
  overdueDeliveryCount: number;
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
  metrics: ReviewMetrics | null;
  isLegacy: boolean;
  body?: string;
}

export interface ReviewMetrics {
  asOf: string;
  completedActions: number | null;
  carryoverEvents: number | null;
  waitingActions: number | null;
  overdueReviews: number | null;
  overdueDeliveries: number | null;
}

export interface CollaboratorRecord {
  id: string;
  title: string;
  relativePath: string;
  version: string;
  status: CollaboratorStatus;
  created: string;
  updated: string;
  assetScope: AssetScope;
  sensitivity: string;
  evidenceStatus: string;
  aliases: string[];
  relationshipRoles: string[];
  projects: string[];
  collaborationTopics: string[];
  sourceNotes: string[];
  sourceThreads: string[];
  body: string;
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

export interface CollaboratorIndexResponse {
  collaborators: CollaboratorRecord[];
  issues: VaultIssue[];
  available: boolean;
}

export interface CreateActionInput {
  title: string;
  actionArea: ActionArea;
  project?: string;
  workstreams?: string[];
  nextAction: string;
  completionStandard: string;
  startOn?: string;
  dueOn?: string;
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

export interface ProjectTransitionInput {
  expectedVersion: string;
  transition: "archive" | "restore";
}

export interface CreateCollaboratorInput {
  name: string;
  aliases?: string[];
  relationshipRoles: string[];
  projects?: string[];
  collaborationTopics?: string[];
  sourceNotes?: string[];
  sourceThreads?: string[];
}

export interface CollaboratorPatch {
  expectedVersion: string;
  aliases?: string[];
  relationshipRoles?: string[];
  projects?: string[];
  collaborationTopics?: string[];
  sourceNotes?: string[];
  sourceThreads?: string[];
}

export interface ActionPatch {
  expectedVersion: string;
  actionArea?: ActionArea;
  projects?: string[];
  workstreams?: string[];
  nextAction?: string;
  completionStandard?: string;
  startOn?: string;
  dueOn?: string;
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
