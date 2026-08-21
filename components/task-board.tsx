"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CyberIcon, type CyberIconName } from "@/components/cyber-icon";
import { hkDate, hkMonth, monthDays, monthLabel, shiftMonth } from "@/lib/calendar";
import { actionProject, groupArchivedActions, groupTaskDateEntries, preferredTaskCalendarDate, TASK_DATE_KINDS, taskDateEntries, taskDateSummary, type TaskDateKind } from "@/lib/task-board";
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
const DATE_LABEL: Record<TaskDateKind, string> = { start: "开始", window: "窗口内", scheduled: "执行", due: "交付", review: "复查" };

function TaskCard({ action, onOpen, dateKinds }: { action: ActionRecord; onOpen: (action: ActionRecord) => void; dateKinds?: TaskDateKind[] }) {
  return <button className="task-row" onClick={() => onOpen(action)} type="button"><span className="task-index">{action.id.slice(-3)}</span><span className="task-main"><strong>{action.title}</strong><small>{actionProject(action)} · {action.nextAction || action.closedReason || "未填写下一动作"}</small></span><span className={`state state-${action.actionState}`}><CyberIcon name={`state-${action.actionState.replace("_", "-")}` as CyberIconName} />{STATE_LABEL[action.actionState]}</span>{dateKinds?.length ? <span className="task-date task-date-kinds" aria-label={`日期角色：${dateKinds.map((kind) => DATE_LABEL[kind]).join("、")}`}>{dateKinds.map((kind) => <span key={kind} className={`task-date-${kind}`}>{DATE_LABEL[kind]}</span>)}</span> : <span className="task-date">{taskDateSummary(action)}</span>}</button>;
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
  const days = useMemo(() => monthDays(month), [month]);
  const dates = useMemo(() => days.filter((date): date is string => Boolean(date)), [days]);
  const entries = useMemo(() => taskDateEntries(actions, dates), [actions, dates]);
  const byDate = useMemo(() => new Map(dates.map((date) => [date, entries.filter((entry) => entry.date === date)])), [dates, entries]);
  const availableDates = useMemo(() => dates.filter((date) => (byDate.get(date)?.length ?? 0) > 0), [byDate, dates]);
  const today = hkDate();
  const displayDate = preferredTaskCalendarDate(availableDates, today, selectedDate);
  const selected = useMemo(() => byDate.get(displayDate) ?? [], [byDate, displayDate]);
  const groups = useMemo(() => groupTaskDateEntries(selected, today), [selected, today]);
  return <section className="task-calendar-view"><aside className="task-calendar"><div className="calendar-head"><button className="icon-button" onClick={() => setMonth((value) => shiftMonth(value, -1))} aria-label="上个月">‹</button><strong>{monthLabel(month)}</strong><button className="icon-button" onClick={() => setMonth((value) => shiftMonth(value, 1))} aria-label="下个月">›</button></div><div className="task-calendar-legend" aria-label="日期信号图例">{TASK_DATE_KINDS.map((kind) => <span key={kind}><i className={`task-calendar-signal task-calendar-signal-${kind}`} aria-hidden="true" />{DATE_LABEL[kind]}</span>)}</div><div className="calendar-weekdays">{["一", "二", "三", "四", "五", "六", "日"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{days.map((date, index) => { const items = date ? byDate.get(date) ?? [] : []; const kinds = TASK_DATE_KINDS.filter((kind) => items.some((item) => item.kinds.includes(kind))); const description = kinds.map((kind) => DATE_LABEL[kind]).join("、"); return date ? <button key={date} className={`calendar-day task-calendar-day ${date === displayDate ? "calendar-selected" : ""} ${items.length ? "calendar-active" : ""}`} disabled={!items.length} onClick={() => setSelectedDate(date)} aria-label={`${date}，${items.length}项任务${description ? `，${description}` : ""}`}><strong>{date.slice(-2)}</strong>{items.length ? <><span className="task-calendar-count">{items.length}项</span><span className="task-calendar-signals" aria-hidden="true">{kinds.map((kind) => <i key={kind} className={`task-calendar-signal task-calendar-signal-${kind}`} />)}</span></> : null}</button> : <span key={`empty-${index}`} className="calendar-empty" />; })}</div></aside><section className="task-calendar-list"><div className="panel-head"><div><p className="eyebrow">DATE QUEUE / {displayDate || "SELECT A DATE"}</p><h2>{displayDate ? `${displayDate} 的任务` : "选择日历中的日期"}</h2></div><span className="counter">{selected.length} ITEMS</span></div>{groups.length ? <div className="task-calendar-projects">{groups.map((group) => <section className="task-calendar-project" key={group.project}><header><h3>{group.project}</h3><span>{group.entries.length} 项</span></header>{group.entries.map((entry) => <TaskCard key={entry.action.id} action={entry.action} dateKinds={entry.kinds} onOpen={onOpen} />)}</section>)}</div> : <div className="empty-state"><strong>本月没有可查看的任务</strong><span>开始至交付日会连续显示；具体排期和复查日期会合并到同一张任务卡。</span></div>}</section></section>;
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
