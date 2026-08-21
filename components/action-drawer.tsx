"use client";

import { useId, useRef, useState } from "react";
import { buildTransitionInput, type TransitionChoice, type TransitionField } from "@/lib/action-transition";
import { CyberIcon } from "@/components/cyber-icon";
import { ModalDialog } from "@/components/modal-dialog";
import type { ActionPatch, ActionRecord, ProjectSummary, TransitionInput } from "@/lib/types";
import { clientTimeZone } from "@/lib/vault-profile";

interface Props {
  action: ActionRecord | null;
  projects: ProjectSummary[];
  writeEnabled: boolean;
  onClose: () => void;
  onSaved: (action: ActionRecord) => void;
}

function hkTomorrow(): string {
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: clientTimeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(Date.now() + 24 * 60 * 60 * 1000)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function deliveryWindowError(startOn: string, dueOn: string): string {
  return startOn && dueOn && startOn > dueOn ? "开始日期不能晚于交付日期。" : "";
}

export function ActionDrawer({ action, projects, writeEnabled, onClose, onSaved }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  return (
    <ModalDialog open={Boolean(action)} onClose={onClose} labelledBy={titleId} className="drawer" initialFocusRef={closeRef}>
      {action ? <DrawerContent key={`${action.id}:${action.version}`} action={action} projects={projects} writeEnabled={writeEnabled} onClose={onClose} onSaved={onSaved} titleId={titleId} closeRef={closeRef} /> : null}
    </ModalDialog>
  );
}

function DrawerContent({ action, projects, writeEnabled, onClose, onSaved, titleId, closeRef }: Omit<Props, "action"> & { action: ActionRecord; titleId: string; closeRef: React.RefObject<HTMLButtonElement | null> }) {
  const [draft, setDraft] = useState<ActionRecord>(action);
  const [selectedTransition, setSelectedTransition] = useState<TransitionChoice | null>(null);
  const [transitionNote, setTransitionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [transitionError, setTransitionError] = useState("");
  const detailsErrorRef = useRef<HTMLParagraphElement>(null);
  const transitionErrorRef = useRef<HTMLParagraphElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const reviewOnRef = useRef<HTMLInputElement>(null);
  const scheduledForRef = useRef<HTMLInputElement>(null);
  const projectName = draft.projects[0]?.replace(/^\[\[/, "").replace(/\]\]$/, "").split("/").pop() ?? "";
  const transitionErrorId = `${titleId}-transition-error`;
  const update = <K extends keyof ActionRecord>(key: K, value: ActionRecord[K]) => setDraft((current) => ({ ...current, [key]: value }));

  function showDetailsError(message: string) {
    setDetailsError(message);
    window.requestAnimationFrame(() => detailsErrorRef.current?.focus());
  }

  function showTransitionError(message: string) {
    setTransitionError(message);
    window.requestAnimationFrame(() => transitionErrorRef.current?.focus());
  }

  async function request(url: string, method: "PATCH" | "POST", payload: ActionPatch | TransitionInput, onError: (message: string) => void): Promise<void> {
    setSaving(true);
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as ActionRecord & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "保存失败");
      onSaved(data);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "保存失败，请稍后再试。");
    } finally {
      setSaving(false);
    }
  }

  function saveDetails() {
    setDetailsError("");
    const windowError = deliveryWindowError(draft.startOn, draft.dueOn);
    if (windowError) {
      showDetailsError(windowError);
      return;
    }
    void request(`/api/actions/${draft.id}`, "PATCH", {
      expectedVersion: draft.version, actionArea: draft.actionArea, projects: projectName ? [projectName] : [], workstreams: draft.workstreams,
      nextAction: draft.nextAction, completionStandard: draft.completionStandard, startOn: draft.startOn, dueOn: draft.dueOn, scheduledFor: draft.scheduledFor, reviewOn: draft.reviewOn, assetScope: draft.assetScope,
    }, showDetailsError);
  }

  function chooseTransition(transition: TransitionChoice) {
    setTransitionError("");
    setTransitionNote("");
    if (transition === "wait" && !draft.reviewOn) update("reviewOn", hkTomorrow());
    setSelectedTransition(transition);
    window.requestAnimationFrame(() => {
      if (transition === "schedule" || transition === "carryover") scheduledForRef.current?.focus();
      else noteRef.current?.focus();
    });
  }

  function focusTransitionField(field: TransitionField) {
    const target = field === "note" ? noteRef : field === "reviewOn" ? reviewOnRef : scheduledForRef;
    window.requestAnimationFrame(() => target.current?.focus());
  }

  function submitTransition(transition: TransitionChoice) {
    const result = buildTransitionInput(draft, transition, transitionNote);
    if (!result.ok) {
      showTransitionError(result.error);
      focusTransitionField(result.field);
      return;
    }
    setTransitionError("");
    void request(`/api/actions/${draft.id}/transition`, "POST", result.payload, showTransitionError);
  }

  const quickActions = draft.actionState === "in_progress"
    ? <div className="quick-actions"><button type="button" disabled={saving} onClick={() => chooseTransition("wait")}><CyberIcon name="state-waiting" />设为等待</button><button type="button" disabled={saving} onClick={() => chooseTransition("complete")}><CyberIcon name="state-done" />完成事项</button></div>
    : <div className="quick-actions"><button type="button" disabled={saving} onClick={() => submitTransition("start")}><CyberIcon name="state-in-progress" />{draft.actionState === "waiting" || draft.actionState === "review" ? "恢复推进" : "开始推进"}</button></div>;

  return <>
    <div className="drawer-head"><div><p className="eyebrow">ACTION FILE / {draft.id}</p><h2 id={titleId}>{draft.title}</h2></div><button ref={closeRef} className="icon-button" type="button" onClick={onClose} aria-label="关闭任务详情"><CyberIcon name="close" /></button></div>
    <div className="drawer-status"><span className={`state state-${draft.actionState}`}><CyberIcon name={`state-${draft.actionState.replace("_", "-")}` as "state-in-progress" | "state-ready" | "state-waiting" | "state-review" | "state-backlog" | "state-done" | "state-cancelled"} />{draft.actionState}</span><span>{draft.status === "active" ? "ACTIVE FILE" : "ARCHIVED FILE"}</span></div>
    {draft.status === "archived" || !writeEnabled ? <div className="action-readonly"><p className="eyebrow">{writeEnabled ? "CLOSED / READ ONLY" : "VAULT VALIDATION / READ ONLY"}</p><dl><div><dt>所属项目</dt><dd>{projectName || "未归类"}</dd></div><div><dt>当前状态</dt><dd>{draft.actionState}</dd></div><div><dt>执行窗口</dt><dd>始 {draft.startOn || "未设置"} · 交 {draft.dueOn || "未设置"}</dd></div><div><dt>具体计划</dt><dd>{draft.scheduledFor || "未设置"}</dd></div><div><dt>{draft.status === "archived" ? "关闭说明" : "下一动作"}</dt><dd>{draft.status === "archived" ? draft.closedReason || "未记录" : draft.nextAction || "未记录"}</dd></div></dl>{!writeEnabled ? <p className="quiet">完成临时 Vault 验证后，将 WORKBENCH_WRITE_ENABLED 设为 true 才能修改任务。</p> : null}</div> : <>
      <section className="transition-bay" aria-labelledby={`${titleId}-transitions`}>
        <p id={`${titleId}-transitions`} className="eyebrow">STATUS CHANGE</p>
        {quickActions}
        <div className="transition-buttons"><button type="button" onClick={() => chooseTransition("schedule")} disabled={saving}><CyberIcon name="schedule" />排入计划</button><button type="button" onClick={() => chooseTransition("carryover")} disabled={saving}><CyberIcon name="carryover" />结转任务</button><button type="button" className="danger-button" onClick={() => chooseTransition("cancel")} disabled={saving}><CyberIcon name="state-cancelled" />取消事项</button></div>
        {selectedTransition ? <TransitionComposer transition={selectedTransition} draft={draft} note={transitionNote} saving={saving} error={transitionError} errorId={transitionErrorId} errorRef={transitionErrorRef} noteRef={noteRef} reviewOnRef={reviewOnRef} scheduledForRef={scheduledForRef} onNoteChange={setTransitionNote} onUpdate={update} onCancel={() => { setSelectedTransition(null); setTransitionError(""); }} onSubmit={() => submitTransition(selectedTransition)} /> : null}
      </section>
      <div className="drawer-form">
        <label>任务范围<select value={draft.actionArea} onChange={(event) => update("actionArea", event.target.value as ActionRecord["actionArea"])}><option value="project">项目</option><option value="personal">个人</option><option value="knowledge">知识库</option><option value="candidate">待归类</option></select></label>
        <label>所属项目<select value={projectName} onChange={(event) => update("projects", event.target.value ? [event.target.value] : [])}><option value="">未归类</option>{projects.filter((item) => item.name !== "未归类").map((item) => <option value={item.name} key={item.name}>{item.name}</option>)}</select></label>
        <label>工作流（用逗号分隔）<input value={draft.workstreams.join("，")} onChange={(event) => update("workstreams", event.target.value.split(/[，,]/).map((item) => item.trim()).filter(Boolean))} /></label>
        <label>下一动作<textarea value={draft.nextAction} onChange={(event) => update("nextAction", event.target.value)} /></label>
        <label>完成标准<textarea value={draft.completionStandard} onChange={(event) => update("completionStandard", event.target.value)} /></label>
        <fieldset className="date-window"><legend>执行窗口</legend><div className="date-window-grid"><label>开始日期<input type="date" value={draft.startOn} onChange={(event) => update("startOn", event.target.value)} /></label><label>交付日期<input type="date" value={draft.dueOn} onChange={(event) => update("dueOn", event.target.value)} /></label><label>计划日期<input type="date" value={draft.scheduledFor} onChange={(event) => update("scheduledFor", event.target.value)} /></label></div></fieldset>
        <label>复查日期<input type="date" value={draft.reviewOn} onChange={(event) => update("reviewOn", event.target.value)} /></label>
        <details><summary>高级设置</summary><label>资产范围<select value={draft.assetScope} onChange={(event) => update("assetScope", event.target.value as ActionRecord["assetScope"])}><option value="project">项目</option><option value="personal">个人</option><option value="organization">组织</option><option value="brand">品牌</option></select></label></details>
        {detailsError ? <p ref={detailsErrorRef} className="form-error" role="alert" tabIndex={-1}>{detailsError}</p> : null}
        <button className="button primary full" type="button" disabled={saving} onClick={saveDetails}><CyberIcon name="save" />{saving ? "正在保存…" : "保存任务资料"}</button>
      </div>
    </>}
  </>;
}

function TransitionComposer({ transition, draft, note, saving, error, errorId, errorRef, noteRef, reviewOnRef, scheduledForRef, onNoteChange, onUpdate, onCancel, onSubmit }: {
  transition: TransitionChoice;
  draft: ActionRecord;
  note: string;
  saving: boolean;
  error: string;
  errorId: string;
  errorRef: React.RefObject<HTMLParagraphElement | null>;
  noteRef: React.RefObject<HTMLTextAreaElement | null>;
  reviewOnRef: React.RefObject<HTMLInputElement | null>;
  scheduledForRef: React.RefObject<HTMLInputElement | null>;
  onNoteChange: (value: string) => void;
  onUpdate: <K extends keyof ActionRecord>(key: K, value: ActionRecord[K]) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const config: Record<Exclude<TransitionChoice, "start">, { title: string; hint: string; noteLabel: string; noteRequired: boolean; confirm: string; danger?: boolean }> = {
    wait: { title: "设为等待", hint: "记录等待原因和下一次复查时间。", noteLabel: "等待说明", noteRequired: true, confirm: "确认设为等待" },
    complete: { title: "完成事项", hint: "记录已经交付或确认的结果。", noteLabel: "完成结果", noteRequired: true, confirm: "确认完成事项" },
    schedule: { title: "排入计划", hint: "为该事项指定执行日期。", noteLabel: "状态说明（可选）", noteRequired: false, confirm: "确认排入计划" },
    carryover: { title: "结转任务", hint: "留空日期会清除排期并进入 Backlog。", noteLabel: "结转说明（可选）", noteRequired: false, confirm: "确认结转" },
    cancel: { title: "取消事项", hint: "取消后任务将归档且仅供查看。", noteLabel: "取消原因", noteRequired: true, confirm: "确认取消事项", danger: true },
  };
  if (transition === "start") return null;
  const current = config[transition];
  const errorFor = (field: TransitionField) => error && ((field === "note" && /说明|结果|原因/.test(error)) || (field === "reviewOn" && /复查日期/.test(error)) || (field === "scheduledFor" && /计划日期/.test(error)));

  return <div className="transition-composer">
    <div><p className="eyebrow">CONFIRM / {transition.toUpperCase()}</p><strong>{current.title}</strong><p className="quiet">{current.hint}</p></div>
    <label>{current.noteLabel}<textarea ref={noteRef} value={note} onChange={(event) => onNoteChange(event.target.value)} aria-invalid={errorFor("note") || undefined} aria-describedby={error ? errorId : undefined} required={current.noteRequired} /></label>
    {transition === "wait" ? <label>复查日期<input ref={reviewOnRef} type="date" value={draft.reviewOn} onChange={(event) => onUpdate("reviewOn", event.target.value)} aria-invalid={errorFor("reviewOn") || undefined} aria-describedby={error ? errorId : undefined} required /></label> : null}
    {transition === "schedule" || transition === "carryover" ? <label>{transition === "schedule" ? "计划日期" : "结转日期（留空进入 Backlog）"}<input ref={scheduledForRef} type="date" value={draft.scheduledFor} onChange={(event) => onUpdate("scheduledFor", event.target.value)} aria-invalid={errorFor("scheduledFor") || undefined} aria-describedby={error ? errorId : undefined} required={transition === "schedule"} /></label> : null}
    {error ? <p ref={errorRef} id={errorId} className="form-error" role="alert" tabIndex={-1}>{error}</p> : null}
    <div className="transition-buttons"><button type="button" disabled={saving} onClick={onCancel}>返回</button><button type="button" className={current.danger ? "danger-button" : "button primary"} disabled={saving} onClick={onSubmit}>{saving ? "正在保存…" : current.confirm}</button></div>
  </div>;
}
