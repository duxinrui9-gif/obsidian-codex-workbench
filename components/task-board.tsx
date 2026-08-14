"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CyberIcon, type CyberIconName } from "@/components/cyber-icon";
import { hkMonth, monthDays, monthLabel, shiftMonth } from "@/lib/calendar";
import { actionProject, groupArchivedActions, taskDateEntries, type TaskDateKind } from "@/lib/task-board";
import type { ActionRecord } from "@/lib/types";

type TaskView = "status" | "calendar" | "completed";

const STATES: Array<{ state: ActionRecord["actionState"]; label: string; icon: CyberIconName }> = [
  { state: "ready", label: "待执行", icon: "state-ready" },
  { state: "in_progress", label: "进行中", icon: "state-in-progress" },
  { state: "waiting", label: "等待", icon: "state-waiting" },
  { state: "review", label: "待确认", icon: "state-review" },
  { state: "backlog", label: "Backlog", icon: "state-backlog" },
];

const STATE_LABEL: Record<ActionRecord["actionState"], string> = { ready: "待执行", in_progress: "进行中", waiting: "等待", review: "待确认", backlog: "Backlog", done: "已完成", cancelled: "已取消" };

function TaskCard({ action, onOpen, dateKind }: { action: ActionRecord; onOpen: (action: ActionRecord) => void; dateKind?: TaskDateKind }) {
  return <button className="task-row" onClick={() => onOpen(action)} type="button"><span className="task-index">{action.id.slice(-3)}</span><span className="task-main"><strong>{action.title}</strong><small>{actionProject(action)} · {action.nextAction || action.closedReason || "未填写下一动作"}</small></span><span className={`state state-${action.actionState}`}><CyberIcon name={`state-${action.actionState.replace("_", "-")}` as CyberIconName} />{STATE_LABEL[action.actionState]}</span>{dateKind ? <span className={`task-date task-date-${dateKind}`}>{dateKind === "scheduled" ? "执行" : "复查"}</span> : <span className="task-date">{action.closedAt || action.scheduledFor || action.reviewOn || "未排期"}</span>}</button>;
}

function StatusBoard({ actions, onOpen }: { actions: ActionRecord[]; onOpen: (action: ActionRecord) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const syncRef = useRef(false);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [clientWidth, setClientWidth] = useState(0);
  useEffect(() => {
    const update = () => { setScrollWidth(innerRef.current?.scrollWidth ?? 0); setClientWidth(scrollRef.current?.clientWidth ?? 0); };
    update();
    const observer = new ResizeObserver(update);
    if (scrollRef.current) observer.observe(scrollRef.current);
    if (innerRef.current) observer.observe(innerRef.current);
    return () => observer.disconnect();
  }, [actions]);
  const sync = (source: HTMLDivElement, target: HTMLDivElement | null) => {
    if (syncRef.current || !target) return;
    syncRef.current = true;
    target.scrollLeft = source.scrollLeft;
    requestAnimationFrame(() => { syncRef.current = false; });
  };
  const move = (amount: number) => scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -320 : 320); } };
  return <section className="task-status-view"><div className="task-scroll-controls"><span>横向查看全部状态</span><button type="button" className="icon-button" aria-label="向左滚动任务列" disabled={scrollLeft <= 0} onClick={() => move(-320)}>‹</button><button type="button" className="icon-button" aria-label="向右滚动任务列" disabled={scrollLeft + clientWidth >= scrollWidth - 1} onClick={() => move(320)}>›</button></div><div className="task-horizontal-scroll" ref={barRef} onScroll={(event) => { setScrollLeft(event.currentTarget.scrollLeft); sync(event.currentTarget, scrollRef.current); }} aria-label="横向滚动任务状态看板" tabIndex={0} onKeyDown={onKeyDown}><i style={{ width: scrollWidth }} /></div><div className="task-status-scroll" ref={scrollRef} onScroll={(event) => { setScrollLeft(event.currentTarget.scrollLeft); sync(event.currentTarget, barRef.current); }}><div className="board-grid task-status-grid" ref={innerRef}>{STATES.map((column) => { const items = actions.filter((action) => action.actionState === column.state); return <section className="board-column" key={column.state}><header><CyberIcon name={column.icon} /><h2>{column.label}</h2><small>{items.length}</small></header>{items.length ? items.map((action) => <TaskCard key={action.id} action={action} onOpen={onOpen} />) : <div className="column-empty">该舱位无任务</div>}</section>; })}</div></div></section>;
}

function TaskCalendar({ actions, onOpen }: { actions: ActionRecord[]; onOpen: (action: ActionRecord) => void }) {
  const [month, setMonth] = useState(hkMonth);
  const [selectedDate, setSelectedDate] = useState("");
  const entries = useMemo(() => taskDateEntries(actions), [actions]);
  const byDate = useMemo(() => new Map(monthDays(month).filter(Boolean).map((date) => [date!, entries.filter((entry) => entry.date === date)])), [entries, month]);
  const selected = byDate.get(selectedDate) ?? [];
  return <section className="task-calendar-view"><aside className="task-calendar"><div className="calendar-head"><button className="icon-button" onClick={() => setMonth((value) => shiftMonth(value, -1))} aria-label="上个月">‹</button><strong>{monthLabel(month)}</strong><button className="icon-button" onClick={() => setMonth((value) => shiftMonth(value, 1))} aria-label="下个月">›</button></div><div className="calendar-weekdays">{["一", "二", "三", "四", "五", "六", "日"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{monthDays(month).map((date, index) => { const items = date ? byDate.get(date) ?? [] : []; return date ? <button key={date} className={`calendar-day task-calendar-day ${date === selectedDate ? "calendar-selected" : ""} ${items.length ? "calendar-active" : ""}`} disabled={!items.length} onClick={() => setSelectedDate(date)}><strong>{date.slice(-2)}</strong>{items.length ? <span><b>{items.filter((item) => item.kind === "scheduled").length}执</b><em>{items.filter((item) => item.kind === "review").length}复</em></span> : null}</button> : <span key={`empty-${index}`} className="calendar-empty" />; })}</div></aside><section className="task-calendar-list"><div className="panel-head"><div><p className="eyebrow">DATE QUEUE / {selectedDate || "SELECT A DATE"}</p><h2>{selectedDate ? `${selectedDate} 的任务` : "选择日历中的日期"}</h2></div><span className="counter">{selected.length} ITEMS</span></div>{selected.length ? selected.map((entry) => <TaskCard key={`${entry.action.id}-${entry.kind}`} action={entry.action} dateKind={entry.kind} onOpen={onOpen} />) : <div className="empty-state"><strong>尚未选择有任务的日期</strong><span>执行任务用“执”标记，等待与复查任务用“复”标记。</span></div>}</section></section>;
}

function CompletedBoard({ actions, onOpen }: { actions: ActionRecord[]; onOpen: (action: ActionRecord) => void }) {
  const groups = groupArchivedActions(actions);
  return <section className="completed-project-grid">{groups.map((group) => <section className="project-panel completed-project" key={group.project}><header><div><p className="eyebrow">CLOSED PROJECT / READ ONLY</p><h2>{group.project}</h2></div><span className="counter">{group.done.length} DONE</span></header>{group.done.length ? <div>{group.done.map((action) => <TaskCard key={action.id} action={action} onOpen={onOpen} />)}</div> : <div className="column-empty">没有已完成任务</div>}{group.cancelled.length ? <details className="cancelled-actions"><summary>已取消 {group.cancelled.length}</summary>{group.cancelled.map((action) => <TaskCard key={action.id} action={action} onOpen={onOpen} />)}</details> : null}</section>)}{!groups.length ? <div className="empty-state"><strong>还没有已结束任务</strong><span>完成或取消后，任务会按所属项目出现在这里。</span></div> : null}</section>;
}

export function TaskBoard({ actions, onOpen }: { actions: ActionRecord[]; onOpen: (action: ActionRecord) => void }) {
  const [view, setView] = useState<TaskView>("status");
  const active = actions.filter((action) => action.status === "active");
  const views: TaskView[] = ["status", "calendar", "completed"];
  const selectByKey = (event: KeyboardEvent<HTMLButtonElement>, current: TaskView) => { const index = views.indexOf(current); const next = event.key === "Home" ? 0 : event.key === "End" ? views.length - 1 : event.key === "ArrowLeft" ? (index + views.length - 1) % views.length : event.key === "ArrowRight" ? (index + 1) % views.length : -1; if (next >= 0) { event.preventDefault(); setView(views[next]); requestAnimationFrame(() => document.getElementById(`task-tab-${views[next]}`)?.focus()); } };
  const tab = (id: TaskView, icon: CyberIconName, label: string) => <button id={`task-tab-${id}`} className={view === id ? "active" : ""} onClick={() => setView(id)} onKeyDown={(event) => selectByKey(event, id)} role="tab" aria-selected={view === id} aria-controls={`task-panel-${id}`} tabIndex={view === id ? 0 : -1}><CyberIcon name={icon} />{label}</button>;
  return <div className="task-board"><div className="task-view-tabs" role="tablist" aria-label="任务视图">{tab("status", "nav-tasks", "状态看板")}{tab("calendar", "nav-daily", "日历看板")}{tab("completed", "state-done", "已完成")}</div><div id="task-panel-status" role="tabpanel" aria-labelledby="task-tab-status" hidden={view !== "status"}><StatusBoard actions={active} onOpen={onOpen} /></div><div id="task-panel-calendar" role="tabpanel" aria-labelledby="task-tab-calendar" hidden={view !== "calendar"}><TaskCalendar actions={active} onOpen={onOpen} /></div><div id="task-panel-completed" role="tabpanel" aria-labelledby="task-tab-completed" hidden={view !== "completed"}><CompletedBoard actions={actions} onOpen={onOpen} /></div></div>;
}
