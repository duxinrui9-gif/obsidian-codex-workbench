import type { ActionRecord } from "@/lib/types";

export type TaskDateKind = "start" | "window" | "scheduled" | "due" | "review";

export interface TaskDateEntry {
  action: ActionRecord;
  date: string;
  kinds: TaskDateKind[];
}

export interface TaskDateProjectGroup {
  project: string;
  entries: TaskDateEntry[];
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

export const TASK_DATE_KINDS: TaskDateKind[] = ["start", "window", "scheduled", "due", "review"];

function entryKinds(action: ActionRecord, date: string): TaskDateKind[] {
  const kinds: TaskDateKind[] = [];
  if (date === action.startOn) kinds.push("start");
  if (action.startOn && action.dueOn && date > action.startOn && date < action.dueOn) kinds.push("window");
  if (date === action.scheduledFor) kinds.push("scheduled");
  if (date === action.dueOn) kinds.push("due");
  if (date === action.reviewOn) kinds.push("review");
  return kinds;
}

export function taskDateEntries(actions: ActionRecord[], dates: readonly string[]): TaskDateEntry[] {
  return dates.flatMap((date) => actions.flatMap((action) => {
    const kinds = entryKinds(action, date);
    return kinds.length ? [{ action, date, kinds }] : [];
  })).sort((left, right) => left.date.localeCompare(right.date) || left.action.updated.localeCompare(right.action.updated) || left.action.title.localeCompare(right.action.title, "zh-Hans-CN"));
}

function taskDatePriority(entry: TaskDateEntry, today: string): number {
  if (entry.kinds.includes("due") || (entry.action.dueOn && entry.action.dueOn < today)) return 0;
  if (entry.action.actionState === "in_progress") return 1;
  if (entry.kinds.includes("scheduled") || entry.kinds.includes("review")) return 2;
  if (entry.kinds.includes("start")) return 3;
  return 4;
}

function compareTaskDateEntries(left: TaskDateEntry, right: TaskDateEntry, today: string): number {
  const priority = taskDatePriority(left, today) - taskDatePriority(right, today);
  if (priority) return priority;
  const due = (left.action.dueOn || "9999-12-31").localeCompare(right.action.dueOn || "9999-12-31");
  return due || right.action.updated.localeCompare(left.action.updated) || left.action.title.localeCompare(right.action.title, "zh-Hans-CN");
}

export function groupTaskDateEntries(entries: TaskDateEntry[], today: string): TaskDateProjectGroup[] {
  const groups = new Map<string, TaskDateEntry[]>();
  for (const entry of entries) {
    const project = actionProject(entry.action);
    groups.set(project, [...(groups.get(project) ?? []), entry]);
  }
  return [...groups.entries()].map(([project, projectEntries]) => ({ project, entries: [...projectEntries].sort((left, right) => compareTaskDateEntries(left, right, today)) })).sort((left, right) => compareTaskDateEntries(left.entries[0], right.entries[0], today) || left.project.localeCompare(right.project, "zh-Hans-CN"));
}

export function preferredTaskCalendarDate(availableDates: readonly string[], today: string, current = ""): string {
  if (current && availableDates.includes(current)) return current;
  if (availableDates.includes(today)) return today;
  return [...availableDates].sort((left, right) => {
    const leftDistance = Math.abs(Date.parse(`${left}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`));
    const rightDistance = Math.abs(Date.parse(`${right}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`));
    return leftDistance - rightDistance || Number(left < today) - Number(right < today) || left.localeCompare(right);
  })[0] ?? "";
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
