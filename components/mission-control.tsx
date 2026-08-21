"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionDrawer } from "@/components/action-drawer";
import { CyberIcon, type CyberIconName } from "@/components/cyber-icon";
import { NewActionForm } from "@/components/new-action-form";
import { NewProjectForm } from "@/components/new-project-form";
import { MissionClock } from "@/components/mission-clock";
import { ReviewConsole } from "@/components/review-console";
import { CollaboratorBoard } from "@/components/collaborator-board";
import { TaskBoard } from "@/components/task-board";
import { VaultIssuesNotice } from "@/components/vault-issues-notice";
import { deliverySignals, sortProjectActions, taskDateSummary, type DeliverySignals, type TaskBoardFilter } from "@/lib/task-board";
import { rovingTabIndex } from "@/lib/roving-tabs";
import { clientTimeZone } from "@/lib/vault-profile";
import { type ActionRecord, type ProjectSummary, type ReviewPeriod, type WorkbenchSnapshot } from "@/lib/types";

type View = "command" | "tasks" | "projects" | "collaborators" | "daily" | "weekly" | "monthly";
type Theme = "dark" | "light";

const NAV: Array<{ id: View; label: string; icon: CyberIconName }> = [
  { id: "command", label: "今日驾驶舱", icon: "nav-command" },
  { id: "tasks", label: "任务看板", icon: "nav-tasks" },
  { id: "projects", label: "项目看板", icon: "nav-projects" },
  { id: "collaborators", label: "协作人", icon: "project-radar" },
  { id: "daily", label: "日报", icon: "nav-daily" },
  { id: "weekly", label: "周报", icon: "nav-weekly" },
  { id: "monthly", label: "月报", icon: "nav-monthly" },
];

const STATE_ICON: Record<ActionRecord["actionState"], CyberIconName> = {
  ready: "state-ready",
  in_progress: "state-in-progress",
  waiting: "state-waiting",
  review: "state-review",
  backlog: "state-backlog",
  done: "state-done",
  cancelled: "state-cancelled",
};

function hkToday(): string {
  return new Intl.DateTimeFormat("zh-CN", { timeZone: clientTimeZone, month: "long", day: "numeric", weekday: "short" }).format(new Date());
}
function hkTodayIso(): string { return new Intl.DateTimeFormat("en-CA", { timeZone: clientTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

function projectLabel(action: ActionRecord): string {
  const item = action.projects[0] ?? "未归类";
  return item.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].split("/").pop() ?? item;
}

function StatePill({ action }: { action: ActionRecord }) {
  const label: Record<ActionRecord["actionState"], string> = {
    ready: "待执行", in_progress: "进行中", waiting: "等待", backlog: "Backlog", review: "待确认", done: "已完成", cancelled: "已取消",
  };
  return <span className={`state state-${action.actionState}`}><CyberIcon name={STATE_ICON[action.actionState]} />{label[action.actionState]}</span>;
}

function TaskRow({ action, onOpen }: { action: ActionRecord; onOpen: (action: ActionRecord) => void }) {
  return (
    <button className="task-row" onClick={() => onOpen(action)} type="button">
      <span className="task-index">{action.id.slice(-3)}</span>
      <span className="task-main"><strong>{action.title}</strong><small>{projectLabel(action)} · {action.nextAction || "尚未填写下一动作"}</small></span>
      <StatePill action={action} />
      <span className="task-date">{taskDateSummary(action)}</span>
    </button>
  );
}

export function MissionControl() {
  const [view, setView] = useState<View>("command");
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [snapshot, setSnapshot] = useState<WorkbenchSnapshot | null>(null);
  const [selected, setSelected] = useState<ActionRecord | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newActionProject, setNewActionProject] = useState("");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarLoaded, setSidebarLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<Theme>("dark");
  const [today, setToday] = useState(hkTodayIso);
  const [taskFilter, setTaskFilter] = useState<TaskBoardFilter | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/workbench", { cache: "no-store" });
      if (!response.ok) throw new Error("无法读取 Vault");
      const next = await response.json() as WorkbenchSnapshot;
      setActions(next.actions);
      setProjects(next.projects);
      setSnapshot(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法连接 Vault");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem("vibe-theme") as Theme | null;
      setTheme(stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("vibe-theme", theme);
  }, [theme]);
  useEffect(() => { const interval = window.setInterval(() => { const next = hkTodayIso(); setToday((current) => current === next ? current : next); }, 60_000); return () => window.clearInterval(interval); }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSidebarCollapsed(window.localStorage.getItem("vibe-sidebar-collapsed") === "true");
      setSidebarLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (sidebarLoaded) window.localStorage.setItem("vibe-sidebar-collapsed", String(sidebarCollapsed)); }, [sidebarCollapsed, sidebarLoaded]);

  const active = actions.filter((item) => item.status === "active");
  const inProgress = active.filter((item) => item.actionState === "in_progress");
  const todayTasks = active.filter((item) => item.actionState === "ready" && item.scheduledFor && item.scheduledFor <= today);
  const overdue = active.filter((item) => item.reviewOn && item.reviewOn < today);
  const delivery = deliverySignals(active, today);
  const waiting = active.filter((item) => item.actionState === "waiting");
  const review = active.filter((item) => item.actionState === "review");
  const backlog = active.filter((item) => item.actionState === "backlog");
  const viewTitle = NAV.find((item) => item.id === view)?.label ?? "任务驾驶舱";
  const writeEnabled = snapshot?.capabilities.writeEnabled ?? false;

  const onSaved = (saved: ActionRecord) => {
    setActions((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
    setSelected(saved);
    void refresh();
  };
  return (
    <main className={`shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <a className="skip-link" href="#mission-main">跳到主内容</a>
      <aside className="sidebar" aria-label="主导航">
        <div className="brand"><span className="brand-mark"><CyberIcon name="brand-core" /></span><div className="brand-copy"><small>VIBE / LOCAL</small><strong>MISSION<br />CONTROL</strong></div><button className="sidebar-toggle" onClick={() => setSidebarCollapsed(true)} aria-label="收起主导航">‹</button></div>
        <nav>{NAV.map((item) => <button key={item.id} title={item.label} className={view === item.id ? "nav-active" : ""} onClick={() => { setView(item.id); if (item.id === "tasks") setTaskFilter(null); }} aria-current={view === item.id ? "page" : undefined}><CyberIcon name={item.icon} /><span className="nav-label">{item.label}</span></button>)}</nav>
        <div className="sidebar-foot"><CyberIcon name={snapshot && !snapshot.issues.length ? "vault-linked" : "vault-disconnected"} /><span>{snapshot && !snapshot.issues.length ? "VAULT LINK / NORMAL" : "VAULT LINK / CHECK"}</span><small>{snapshot ? `${snapshot.actionCount} ACTIONS · ${snapshot.projectCount} PROJECTS` : "SCANNING"}</small></div>
      </aside>
      {sidebarCollapsed ? <button className="sidebar-reopen" onClick={() => setSidebarCollapsed(false)} aria-label="展开主导航">›</button> : null}
      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">MISSION DAY / {hkToday()}</p><h1>{viewTitle}</h1></div>
          <div className="top-controls"><div className="clock"><span>HK TIME</span><strong><MissionClock /></strong></div>{!writeEnabled ? <span className="readonly-mode" title="完成 Vault 验证后，在 .env.local 中设置 WORKBENCH_WRITE_ENABLED=true">只读接入</span> : null}<button className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="切换明暗主题"><CyberIcon name={theme === "dark" ? "theme-light" : "theme-dark"} /></button><button className="button secondary" onClick={() => void refresh()}><CyberIcon name="refresh" />刷新数据</button><button className="button secondary" disabled={!writeEnabled} onClick={() => setNewProjectOpen(true)}> <CyberIcon name="add" />新建项目</button><button className="button primary" disabled={!writeEnabled} onClick={() => { setNewActionProject(""); setNewOpen(true); }}><CyberIcon name="add" />新建事项</button></div>
        </header>
        <section id="mission-main" className="mission-main">
          {error ? <div className="system-error"><strong>连接失败</strong><span>{error}</span><button className="button secondary" onClick={() => void refresh()}>重新连接</button></div> : null}
          {loading ? <div className="loading-grid" aria-label="正在读取任务数据"><i /><i /><i /><i /></div> : null}
          {!loading && !error ? <VaultIssuesNotice issues={snapshot?.issues ?? []} vaultName={snapshot?.vaultName ?? ""} /> : null}
          {!loading && !error && view === "command" ? <CommandDeck inProgress={inProgress} todayTasks={todayTasks} overdue={overdue} delivery={delivery} waiting={waiting} review={review} backlog={backlog} projects={projects} onOpen={setSelected} onViewChange={setView} onTaskFilter={(filter) => { setTaskFilter(filter); setView("tasks"); }} /> : null}
          {!loading && !error && view === "tasks" ? <TaskBoard actions={actions} onOpen={setSelected} filter={taskFilter} onClearFilter={() => setTaskFilter(null)} /> : null}
          {!loading && !error && view === "projects" ? <ProjectBoard projects={projects} writeEnabled={writeEnabled} onOpen={setSelected} onCreate={() => setNewProjectOpen(true)} onNewAction={(project) => { setNewActionProject(project); setNewOpen(true); }} /> : null}
          {!loading && !error && view === "collaborators" ? <CollaboratorBoard projects={projects} writeEnabled={writeEnabled} vaultName={snapshot?.vaultName ?? ""} /> : null}
          {!loading && !error && (view === "daily" || view === "weekly" || view === "monthly") ? <ReviewConsole key={view} period={view as ReviewPeriod} vaultName={snapshot?.vaultName ?? ""} /> : null}
        </section>
      </section>
      <ActionDrawer action={selected} projects={projects} writeEnabled={writeEnabled} onClose={() => setSelected(null)} onSaved={onSaved} />
      <NewActionForm open={newOpen} projects={projects} initialProject={newActionProject} onClose={() => { setNewOpen(false); setNewActionProject(""); }} onCreated={(action) => { setNewOpen(false); setNewActionProject(""); onSaved(action); }} />
      <NewProjectForm open={newProjectOpen} onClose={() => setNewProjectOpen(false)} onCreated={(project) => { setNewProjectOpen(false); setProjects((items) => [...items.filter((item) => item.name !== project.name), project]); void refresh(); }} />
    </main>
  );
}

function CommandDeck({ inProgress, todayTasks, overdue, delivery, waiting, review, backlog, projects, onOpen, onViewChange, onTaskFilter }: { inProgress: ActionRecord[]; todayTasks: ActionRecord[]; overdue: ActionRecord[]; delivery: DeliverySignals; waiting: ActionRecord[]; review: ActionRecord[]; backlog: ActionRecord[]; projects: ProjectSummary[]; onOpen: (action: ActionRecord) => void; onViewChange: (view: View) => void; onTaskFilter: (filter: TaskBoardFilter) => void }) {
  const next = inProgress[0] ?? todayTasks[0] ?? overdue[0];
  const signal = (items: ActionRecord[], label: string, icon: CyberIconName, tone: "start" | "due" | "overdue") => <button type="button" className={`delivery-signal delivery-signal-${tone}`} disabled={!items.length} onClick={() => items[0] && onOpen(items[0])}><CyberIcon name={icon} /><strong>{items.length}</strong><span>{label}</span></button>;
  return <div className="command-grid">
    <section className="panel execution-panel"><div className="panel-head"><div><p className="eyebrow">FLIGHT PATH / EXECUTION</p><h2>推进舱</h2></div><span className="counter">{inProgress.length + todayTasks.length} ACTIVE</span></div>{next ? <button className="next-action" onClick={() => onOpen(next)}><CyberIcon name="next-action" className="next-action-icon" /><span><small>NEXT ACTION</small><strong>{next.title}</strong><em>{next.nextAction}</em></span><StatePill action={next} /></button> : <div className="empty-state"><strong>推进舱暂时清空</strong><span>把一张事项排入今天，或从 Backlog 启动一个任务。</span></div>}<div className="delivery-signals" aria-label="今日交付提醒">{signal(delivery.startsToday, "今日启动", "state-ready", "start")}{signal(delivery.dueToday, "今日交付", "schedule", "due")}{signal(delivery.overdueDelivery, "逾期交付", "overdue", "overdue")}</div><div className="feed"><div className="feed-head"><span>进行中</span><span>{inProgress.length}</span></div>{inProgress.slice(0, 4).map((action) => <TaskRow key={action.id} action={action} onOpen={onOpen} />)}{!inProgress.length ? <p className="quiet">没有进行中的任务。</p> : null}<div className="feed-head"><span>今日待执行</span><span>{todayTasks.length}</span></div>{todayTasks.slice(0, 5).map((action) => <TaskRow key={action.id} action={action} onOpen={onOpen} />)}{!todayTasks.length ? <p className="quiet">今天还没有排期事项。</p> : null}</div></section>
    <aside className="risk-stack"><section className="panel risk-panel"><div className="panel-head"><div><p className="eyebrow">SYSTEM WATCH / RISK</p><h2><CyberIcon name="risk-watch" />风险舱</h2></div><button className="text-button" onClick={() => onTaskFilter("overdue_review")}>打开看板</button></div><div className="risk-matrix"><button onClick={() => onTaskFilter("overdue_review")}><CyberIcon name="overdue" /><span className="risk-num danger">{overdue.length}</span><small>逾期复查</small></button><button onClick={() => onTaskFilter("waiting")}><CyberIcon name="state-waiting" /><span className="risk-num wait">{waiting.length}</span><small>等待反馈</small></button><button onClick={() => onTaskFilter("review")}><CyberIcon name="state-review" /><span className="risk-num review">{review.length}</span><small>待确认</small></button><button onClick={() => onTaskFilter("backlog")}><CyberIcon name="state-backlog" /><span className="risk-num backlog">{backlog.length}</span><small>Backlog</small></button></div>{overdue.slice(0, 3).map((action) => <TaskRow key={action.id} action={action} onOpen={onOpen} />)}{!overdue.length ? <p className="quiet">没有逾期复查。系统运行平稳。</p> : null}</section><section className="panel project-radar"><div className="panel-head"><div><p className="eyebrow">PROJECT RADAR</p><h2><CyberIcon name="project-radar" />项目雷达</h2></div><button className="text-button" onClick={() => onViewChange("projects")}>全部项目</button></div>{projects.filter((project) => project.activeCount).slice(0, 5).map((project) => <div className="radar-row" key={project.name}><span className="radar-pin" /><strong>{project.name}</strong><span>{project.activeCount} TASKS</span><em>{project.overdueDeliveryCount ? `${project.overdueDeliveryCount} DELIVERY OVERDUE` : project.overdueCount ? `${project.overdueCount} REVIEW OVERDUE` : project.inProgressCount ? `${project.inProgressCount} RUNNING` : "STANDBY"}</em></div>)}</section></aside>
  </div>;
}

function ProjectBoard({ projects, writeEnabled, onOpen, onCreate, onNewAction }: { projects: ProjectSummary[]; writeEnabled: boolean; onOpen: (action: ActionRecord) => void; onCreate: () => void; onNewAction: (project: string) => void }) {
  const [tab, setTab] = useState<"active" | "archived">("active");
  const activeProjects = projects.filter((project) => project.name === "未归类" ? project.activeCount > 0 : project.hasProjectPage ? project.status === "active" || project.status === "review" || project.status === "unknown" : project.activeCount > 0);
  const endedProjects = projects.filter((project) => project.hasProjectPage && project.status === "archived");
  const visible = tab === "active" ? activeProjects : endedProjects;
  const tabs = ["active", "archived"] as const;
  const onTabKey = (event: React.KeyboardEvent<HTMLButtonElement>, current: typeof tab) => { const next = rovingTabIndex(tabs.indexOf(current), event.key, tabs.length); if (next !== null) { event.preventDefault(); setTab(tabs[next]); requestAnimationFrame(() => document.getElementById(`project-${tabs[next]}-tab`)?.focus()); } };
  return <div className="project-board">
    <div className="panel-head"><div><p className="eyebrow">MISSION DIRECTORY</p><h2>项目看板</h2></div><button className="button primary" disabled={!writeEnabled} onClick={onCreate}><CyberIcon name="add" />新建项目</button></div>
    <div className="project-view-tabs" role="tablist" aria-label="项目范围"><button id="project-active-tab" role="tab" aria-selected={tab === "active"} aria-controls="project-board-panel" tabIndex={tab === "active" ? 0 : -1} className={tab === "active" ? "active" : ""} onClick={() => setTab("active")} onKeyDown={(event) => onTabKey(event, "active")}>进行中</button><button id="project-archived-tab" role="tab" aria-selected={tab === "archived"} aria-controls="project-board-panel" tabIndex={tab === "archived" ? 0 : -1} className={tab === "archived" ? "active" : ""} onClick={() => setTab("archived")} onKeyDown={(event) => onTabKey(event, "archived")}>已结束</button></div>
    <div id="project-board-panel" role="tabpanel" aria-labelledby={`project-${tab}-tab`} className="project-grid">
      {visible.map((project) => <section className="project-panel" key={project.name}>
        <header><div><p className="eyebrow">{tab === "archived" ? "CLOSED MISSION / READ ONLY" : "MISSION CLUSTER"}</p><h2>{project.name}</h2></div><span className="counter">{tab === "archived" ? `${project.doneCount} DONE` : `${project.activeCount} OPEN`}</span></header>
        {tab === "active" ? <><div className="project-metrics"><span><b>{project.inProgressCount}</b>进行中</span><span><b>{project.waitingCount}</b>等待</span><span><b>{project.overdueCount}</b>逾期复查</span><span><b>{project.overdueDeliveryCount}</b>逾期交付</span></div><button className="text-button project-new-action" disabled={!writeEnabled} onClick={() => onNewAction(project.name)}><CyberIcon name="add" />新建事项</button><div>{sortProjectActions(project.tasks).map((task) => <TaskRow key={task.id} action={task} onOpen={onOpen} />)}{!project.tasks.length ? <div className="column-empty">尚未建立任务</div> : null}</div></> : <><div className="project-metrics"><span><b>{project.doneCount}</b>完成</span><span><b>{project.cancelledCount}</b>取消</span><span><b>{project.activeCount}</b>仍活跃</span></div>{project.activeCount ? <p className="project-risk">风险：项目已结束，但仍有 {project.activeCount} 个活跃任务可继续打开查看。</p> : null}<div>{sortProjectActions(project.doneTasks).map((task) => <TaskRow key={task.id} action={task} onOpen={onOpen} />)}{!project.doneTasks.length ? <div className="column-empty">没有已完成任务</div> : null}</div>{project.cancelledTasks.length ? <details className="cancelled-actions"><summary>已取消 {project.cancelledCount}</summary>{sortProjectActions(project.cancelledTasks).map((task) => <TaskRow key={task.id} action={task} onOpen={onOpen} />)}</details> : null}</>}
      </section>)}
      {!visible.length ? <div className="empty-state"><strong>{tab === "archived" ? "还没有已结束项目" : "还没有进行中项目"}</strong><span>{tab === "archived" ? "项目页状态为 archived 后会显示在这里。" : "创建项目或为事项关联项目后会显示在这里。"}</span></div> : null}
    </div>
  </div>;
}
