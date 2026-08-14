import type { ActionRecord } from "@/lib/types";

export type TaskDateKind = "scheduled" | "review";

export interface TaskDateEntry {
  action: ActionRecord;
  date: string;
  kind: TaskDateKind;
}

export interface ProjectActionGroup {
  project: string;
  done: ActionRecord[];
  cancelled: ActionRecord[];
}

export function actionProject(action: ActionRecord): string {
  const value = action.projects[0] ?? "未归类";
  return value.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].split("/").pop() ?? value;
}

export function taskDateEntries(actions: ActionRecord[]): TaskDateEntry[] {
  return actions.flatMap((action) => [
    ...(action.scheduledFor ? [{ action, date: action.scheduledFor, kind: "scheduled" as const }] : []),
    ...(action.reviewOn ? [{ action, date: action.reviewOn, kind: "review" as const }] : []),
  ]).sort((left, right) => left.date.localeCompare(right.date) || left.action.updated.localeCompare(right.action.updated));
}

export function sortProjectActions(actions: ActionRecord[]): ActionRecord[] {
  return [...actions].sort((left, right) => {
    const running = Number(right.actionState === "in_progress") - Number(left.actionState === "in_progress");
    return running || right.updated.localeCompare(left.updated) || left.title.localeCompare(right.title, "zh-Hans-CN");
  });
}

export function groupArchivedActions(actions: ActionRecord[]): ProjectActionGroup[] {
  const groups = new Map<string, ProjectActionGroup>();
  for (const action of actions.filter((item) => item.status === "archived")) {
    const project = actionProject(action);
    const current = groups.get(project) ?? { project, done: [], cancelled: [] };
    if (action.actionState === "done") current.done.push(action);
    if (action.actionState === "cancelled") current.cancelled.push(action);
    groups.set(project, current);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    done: [...group.done].sort((left, right) => (right.closedAt || right.updated).localeCompare(left.closedAt || left.updated)),
    cancelled: [...group.cancelled].sort((left, right) => (right.closedAt || right.updated).localeCompare(left.closedAt || left.updated)),
  })).sort((left, right) => left.project.localeCompare(right.project, "zh-Hans-CN"));
}
