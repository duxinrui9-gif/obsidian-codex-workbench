import type { ActionRecord, ActionState, ProjectSummary } from "@/lib/types";

export type TaskDateFilter = "" | "starts_today" | "scheduled_today" | "due_today" | "overdue_delivery" | "overdue_review" | "undated";
export interface TaskFilters { query: string; project: string; state: ActionState | ""; date: TaskDateFilter; }
export interface ProjectFilters { query: string; health: ProjectHealthFilter; }
export type ProjectHealthFilter = "" | "in_progress" | "waiting" | "overdue_review" | "overdue_delivery" | "zero_active" | "residual_active" | "has_done" | "has_cancelled";
export type ProjectTab = "active" | "archived";

export const EMPTY_TASK_FILTERS: TaskFilters = { query: "", project: "", state: "", date: "" };
export const EMPTY_PROJECT_FILTERS: ProjectFilters = { query: "", health: "" };

export function actionProject(action: ActionRecord): string {
  const value = action.projects[0] ?? "未归类";
  return value.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].split("/").pop() ?? value;
}

export function taskProjects(actions: ActionRecord[]): string[] {
  return [...new Set(actions.map(actionProject))].sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
}

function isDateMatch(action: ActionRecord, date: TaskDateFilter, today: string): boolean {
  switch (date) {
    case "starts_today": return action.startOn === today;
    case "scheduled_today": return action.scheduledFor === today;
    case "due_today": return action.dueOn === today;
    case "overdue_delivery": return action.status === "active" && Boolean(action.dueOn && action.dueOn < today);
    case "overdue_review": return action.status === "active" && Boolean(action.reviewOn && action.reviewOn < today);
    case "undated": return !action.startOn && !action.scheduledFor && !action.dueOn && !action.reviewOn;
    default: return true;
  }
}

export function filterTaskActions(actions: ActionRecord[], filters: TaskFilters, today: string): ActionRecord[] {
  const query = filters.query.trim().toLocaleLowerCase("zh-Hans-CN");
  return actions.filter((action) => {
    const searchable = [action.title, action.nextAction, action.closedReason, ...action.workstreams].join(" ").toLocaleLowerCase("zh-Hans-CN");
    return (!query || searchable.includes(query))
      && (!filters.project || actionProject(action) === filters.project)
      && (!filters.state || action.actionState === filters.state)
      && isDateMatch(action, filters.date, today);
  });
}

export function projectInTab(project: ProjectSummary, tab: ProjectTab): boolean {
  if (tab === "archived") return project.hasProjectPage && project.status === "archived";
  return project.name === "未归类"
    ? project.activeCount > 0
    : project.hasProjectPage
      ? project.status === "active" || project.status === "review" || project.status === "unknown"
      : project.activeCount > 0;
}

export function projectHealthOptions(tab: ProjectTab): Array<{ value: ProjectHealthFilter; label: string }> {
  return tab === "active"
    ? [{ value: "", label: "全部健康度" }, { value: "in_progress", label: "正在推进" }, { value: "waiting", label: "等待反馈" }, { value: "overdue_review", label: "逾期复查" }, { value: "overdue_delivery", label: "逾期交付" }, { value: "zero_active", label: "零活跃任务" }]
    : [{ value: "", label: "全部结束项目" }, { value: "residual_active", label: "仍有活跃任务" }, { value: "has_done", label: "包含完成任务" }, { value: "has_cancelled", label: "包含取消任务" }];
}

function projectMatchesHealth(project: ProjectSummary, health: ProjectHealthFilter): boolean {
  switch (health) {
    case "in_progress": return project.inProgressCount > 0;
    case "waiting": return project.waitingCount > 0;
    case "overdue_review": return project.overdueCount > 0;
    case "overdue_delivery": return project.overdueDeliveryCount > 0;
    case "zero_active": return project.activeCount === 0;
    case "residual_active": return project.activeCount > 0;
    case "has_done": return project.doneCount > 0;
    case "has_cancelled": return project.cancelledCount > 0;
    default: return true;
  }
}

export function filterProjects(projects: ProjectSummary[], tab: ProjectTab, filters: ProjectFilters): ProjectSummary[] {
  const query = filters.query.trim().toLocaleLowerCase("zh-Hans-CN");
  return projects.filter((project) => projectInTab(project, tab)
    && (!query || project.name.toLocaleLowerCase("zh-Hans-CN").includes(query))
    && projectMatchesHealth(project, filters.health));
}
