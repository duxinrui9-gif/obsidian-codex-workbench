import type { ActionRecord } from "@/lib/types";

export type TaskDateKind = "start" | "scheduled" | "due" | "review";

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

export interface DeliverySignals {
  startsToday: ActionRecord[];
  dueToday: ActionRecord[];
  overdueDelivery: ActionRecord[];
}

export function actionProject(action: ActionRecord): string {
  const value = action.projects[0] ?? "未归类";
  return value.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].split("/").pop() ?? value;
}

export function taskDateEntries(actions: ActionRecord[]): TaskDateEntry[] {
  return actions.flatMap((action) => [
    ...(action.startOn ? [{ action, date: action.startOn, kind: "start" as const }] : []),
    ...(action.scheduledFor ? [{ action, date: action.scheduledFor, kind: "scheduled" as const }] : []),
    ...(action.dueOn ? [{ action, date: action.dueOn, kind: "due" as const }] : []),
    ...(action.reviewOn ? [{ action, date: action.reviewOn, kind: "review" as const }] : []),
  ]).sort((left, right) => left.date.localeCompare(right.date) || left.action.updated.localeCompare(right.action.updated));
}

export function deliverySignals(actions: ActionRecord[], today: string): DeliverySignals {
  const active = actions.filter((action) => action.status === "active");
  return {
    startsToday: active.filter((action) => action.startOn === today),
    dueToday: active.filter((action) => action.dueOn === today),
    overdueDelivery: active.filter((action) => action.dueOn && action.dueOn < today),
  };
}

export function taskDateSummary(action: ActionRecord): string {
  if (action.status === "archived" && action.closedAt) return `关 ${action.closedAt.slice(5)}`;
  const dates = [
    ...(action.startOn ? [`始 ${action.startOn.slice(5)}`] : []),
    ...(action.dueOn ? [`交 ${action.dueOn.slice(5)}`] : []),
  ];
  if (dates.length) return dates.join(" · ");
  if (action.scheduledFor) return `执 ${action.scheduledFor.slice(5)}`;
  if (action.reviewOn) return `复 ${action.reviewOn.slice(5)}`;
  return "未排期";
}

export function sortProjectActions(actions: ActionRecord[]): ActionRecord[] {
  return [...actions].sort((left, right) => {
    if (left.status === "archived" || right.status === "archived") {
      return (right.closedAt || right.updated).localeCompare(left.closedAt || left.updated) || left.title.localeCompare(right.title, "zh-Hans-CN");
    }
    const running = Number(right.actionState === "in_progress") - Number(left.actionState === "in_progress");
    const due = (left.dueOn || "9999-12-31").localeCompare(right.dueOn || "9999-12-31");
    return running || due || right.updated.localeCompare(left.updated) || left.title.localeCompare(right.title, "zh-Hans-CN");
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
