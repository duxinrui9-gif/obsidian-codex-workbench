"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CyberIcon, type CyberIconName } from "@/components/cyber-icon";
import { ModalDialog } from "@/components/modal-dialog";
import { EMPTY_PROJECT_FILTERS, filterProjects, projectHealthOptions, type ProjectFilters, type ProjectTab } from "@/lib/board-filters";
import { sortProjectActions } from "@/lib/task-board";
import type { ActionRecord, ProjectSummary, ProjectTransitionInput } from "@/lib/types";
import { rovingTabIndex } from "@/lib/roving-tabs";

const STATE_LABEL: Record<ActionRecord["actionState"], string> = { ready: "待执行", in_progress: "进行中", waiting: "等待", review: "待确认", backlog: "Backlog", done: "已完成", cancelled: "已取消" };
const STATE_ICON: Record<ActionRecord["actionState"], CyberIconName> = { ready: "state-ready", in_progress: "state-in-progress", waiting: "state-waiting", review: "state-review", backlog: "state-backlog", done: "state-done", cancelled: "state-cancelled" };

function TaskRow({ action, onOpen }: { action: ActionRecord; onOpen: (action: ActionRecord) => void }) {
  const project = (action.projects[0] ?? "未归类").replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].split("/").pop() ?? "未归类";
  return <button className="task-row" onClick={() => onOpen(action)} type="button"><span className="task-index">{action.id.slice(-3)}</span><span className="task-main"><strong>{action.title}</strong><small>{project} · {action.nextAction || action.closedReason || "尚未填写下一动作"}</small></span><span className={`state state-${action.actionState}`}><CyberIcon name={STATE_ICON[action.actionState]} />{STATE_LABEL[action.actionState]}</span><span className="task-date">{action.status === "archived" && action.closedAt ? `关 ${action.closedAt.slice(5)}` : action.dueOn ? `交 ${action.dueOn.slice(5)}` : "未排期"}</span></button>;
}

function ProjectTransitionDialog({ project, transition, onClose, onSaved }: { project: ProjectSummary | null; transition: ProjectTransitionInput["transition"]; onClose: () => void; onSaved: (project: ProjectSummary, message: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const isArchive = transition === "archive";
  const close = () => { if (!saving) { setError(""); onClose(); } };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!project) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: project.version, transition }) });
      const data = await response.json() as ProjectSummary & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "项目状态更新失败");
      onSaved(data, isArchive ? `已结束项目：${data.name}` : `已恢复项目：${data.name}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "项目状态更新失败，请稍后重试。");
      window.requestAnimationFrame(() => errorRef.current?.focus());
    } finally { setSaving(false); }
  }
  return <ModalDialog open={Boolean(project)} onClose={close} labelledBy={titleId} className="project-transition-dialog" initialFocusRef={closeRef}><form onSubmit={submit}><header><div><p className="eyebrow">PROJECT LIFECYCLE</p><h2 id={titleId}>{isArchive ? "结束项目" : "恢复项目"}</h2></div><button ref={closeRef} className="icon-button" type="button" onClick={close} aria-label="关闭项目状态操作"><CyberIcon name="close" /></button></header><p>{isArchive ? `确认将“${project?.name ?? ""}”移入已结束项目？` : `确认将“${project?.name ?? ""}”恢复为进行中项目？`}</p>{isArchive && project?.activeCount ? <p className="project-transition-warning">该项目仍有 {project.activeCount} 个活跃任务。结束项目不会完成、取消或隐藏这些任务，它们会继续出现在任务看板。</p> : null}{error ? <p ref={errorRef} className="form-error" role="alert" tabIndex={-1}>{error}</p> : null}<footer><button className="button secondary" type="button" onClick={close} disabled={saving}>保留原状</button><button className={`button ${isArchive ? "secondary danger-button" : "primary"}`} disabled={saving}>{saving ? "正在更新…" : isArchive ? "确认结束项目" : "确认恢复项目"}</button></footer></form></ModalDialog>;
}

export function ProjectBoard({ projects, writeEnabled, onOpen, onCreate, onNewAction, onTransitioned }: { projects: ProjectSummary[]; writeEnabled: boolean; onOpen: (action: ActionRecord) => void; onCreate: () => void; onNewAction: (project: string) => void; onTransitioned: (project: ProjectSummary) => void }) {
  const [tab, setTab] = useState<ProjectTab>("active");
  const [filters, setFilters] = useState<ProjectFilters>({ ...EMPTY_PROJECT_FILTERS });
  const [target, setTarget] = useState<ProjectSummary | null>(null);
  const [transition, setTransition] = useState<ProjectTransitionInput["transition"]>("archive");
  const [message, setMessage] = useState("");
  const visible = useMemo(() => filterProjects(projects, tab, filters), [filters, projects, tab]);
  const tabs: ProjectTab[] = ["active", "archived"];
  const hasFilters = Boolean(filters.query || filters.health);
  const selectTab = (next: ProjectTab) => { setTab(next); setFilters((current) => ({ ...current, health: "" })); };
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, current: ProjectTab) => { const next = rovingTabIndex(tabs.indexOf(current), event.key, tabs.length); if (next !== null) { event.preventDefault(); selectTab(tabs[next]); requestAnimationFrame(() => document.getElementById(`project-${tabs[next]}-tab`)?.focus()); } };
  const requestTransition = (project: ProjectSummary, next: ProjectTransitionInput["transition"]) => { setTarget(project); setTransition(next); setMessage(""); };
  const saved = (project: ProjectSummary, nextMessage: string) => { onTransitioned(project); setMessage(nextMessage); setTarget(null); };
  return <div className="project-board"><div className="panel-head"><div><p className="eyebrow">MISSION DIRECTORY</p><h2>项目看板</h2></div><button className="button primary" disabled={!writeEnabled} onClick={onCreate}><CyberIcon name="add" />新建项目</button></div><div className="project-view-tabs" role="tablist" aria-label="项目范围"><button id="project-active-tab" role="tab" aria-selected={tab === "active"} aria-controls="project-board-panel" tabIndex={tab === "active" ? 0 : -1} className={tab === "active" ? "active" : ""} onClick={() => selectTab("active")} onKeyDown={(event) => onTabKey(event, "active")}>进行中</button><button id="project-archived-tab" role="tab" aria-selected={tab === "archived"} aria-controls="project-board-panel" tabIndex={tab === "archived" ? 0 : -1} className={tab === "archived" ? "active" : ""} onClick={() => selectTab("archived")} onKeyDown={(event) => onTabKey(event, "archived")}>已结束</button></div><div className="board-filters project-filters" aria-label="项目筛选"><label>项目名称<input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="搜索项目名称" /></label><label>项目健康度<select value={filters.health} onChange={(event) => setFilters((current) => ({ ...current, health: event.target.value as ProjectFilters["health"] }))}>{projectHealthOptions(tab).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><div className="board-filter-actions"><span role="status">{hasFilters ? `筛选：${visible.length} 项` : `当前：${visible.length} 项`}</span><button className="text-button" type="button" disabled={!hasFilters} onClick={() => setFilters({ ...EMPTY_PROJECT_FILTERS })}>清除筛选</button></div></div>{message ? <p className="project-transition-success" role="status">{message}</p> : null}<div id="project-board-panel" role="tabpanel" aria-labelledby={`project-${tab}-tab`} className="project-grid">{visible.map((project) => <section className="project-panel" key={project.name}><header><div><p className="eyebrow">{tab === "archived" ? "CLOSED MISSION / READ ONLY" : "MISSION CLUSTER"}</p><h2>{project.name}</h2></div><span className="counter">{tab === "archived" ? `${project.doneCount} DONE` : `${project.activeCount} OPEN`}</span></header>{tab === "active" ? <><div className="project-metrics"><span><b>{project.inProgressCount}</b>进行中</span><span><b>{project.waitingCount}</b>等待</span><span><b>{project.overdueCount}</b>逾期复查</span><span><b>{project.overdueDeliveryCount}</b>逾期交付</span></div><div className="project-card-actions"><button className="text-button project-new-action" disabled={!writeEnabled} onClick={() => onNewAction(project.name)}><CyberIcon name="add" />新建事项</button><button className="text-button danger-button" disabled={!writeEnabled || !project.id || !["active", "review"].includes(project.status)} onClick={() => requestTransition(project, "archive")}>结束项目</button></div><div>{sortProjectActions(project.tasks).map((task) => <TaskRow key={task.id} action={task} onOpen={onOpen} />)}{!project.tasks.length ? <div className="column-empty">尚未建立任务</div> : null}</div></> : <><div className="project-metrics"><span><b>{project.doneCount}</b>完成</span><span><b>{project.cancelledCount}</b>取消</span><span><b>{project.activeCount}</b>仍活跃</span></div>{project.activeCount ? <p className="project-risk">风险：项目已结束，但仍有 {project.activeCount} 个活跃任务可继续打开查看。</p> : null}<button className="text-button" disabled={!writeEnabled || !project.id} onClick={() => requestTransition(project, "restore")}>恢复项目</button><div>{sortProjectActions(project.doneTasks).map((task) => <TaskRow key={task.id} action={task} onOpen={onOpen} />)}{!project.doneTasks.length ? <div className="column-empty">没有已完成任务</div> : null}</div>{project.cancelledTasks.length ? <details className="cancelled-actions"><summary>已取消 {project.cancelledCount}</summary>{sortProjectActions(project.cancelledTasks).map((task) => <TaskRow key={task.id} action={task} onOpen={onOpen} />)}</details> : null}</>}</section>)}{!visible.length ? <div className="empty-state"><strong>{hasFilters ? "没有符合筛选条件的项目" : tab === "archived" ? "还没有已结束项目" : "还没有进行中项目"}</strong><span>{hasFilters ? "可调整或清除筛选条件。" : tab === "archived" ? "项目页状态为 archived 后会显示在这里。" : "创建项目或为事项关联项目后会显示在这里。"}</span></div> : null}</div><ProjectTransitionDialog project={target} transition={transition} onClose={() => setTarget(null)} onSaved={saved} /></div>;
}
