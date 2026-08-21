"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CyberIcon } from "@/components/cyber-icon";
import { ModalDialog } from "@/components/modal-dialog";
import type { ActionRecord, ProjectSummary } from "@/lib/types";

function deliveryWindowError(startOn: string, dueOn: string): string {
  return startOn && dueOn && startOn > dueOn ? "开始日期不能晚于交付日期。" : "";
}

export function NewActionForm({ open, projects, initialProject = "", onClose, onCreated }: { open: boolean; projects: ProjectSummary[]; initialProject?: string; onClose: () => void; onCreated: (action: ActionRecord) => void }) {
  const [title, setTitle] = useState("");
  const [actionArea, setActionArea] = useState("project");
  const [project, setProject] = useState("");
  const [workstreams, setWorkstreams] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [completionStandard, setCompletionStandard] = useState("");
  const [startOn, setStartOn] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [assetScope, setAssetScope] = useState("project");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setProject(initialProject), 0);
    return () => window.clearTimeout(timer);
  }, [initialProject, open]);

  function showError(message: string) {
    setError(message);
    window.requestAnimationFrame(() => errorRef.current?.focus());
  }

  function close() {
    setError("");
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const windowError = deliveryWindowError(startOn, dueOn);
    if (windowError) { showError(windowError); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, actionArea, project, workstreams: workstreams.split(/[，,]/).map((item) => item.trim()).filter(Boolean), nextAction, completionStandard, startOn, dueOn, scheduledFor, assetScope }) });
      const data = await response.json() as ActionRecord & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "创建失败");
      onCreated(data);
      setTitle(""); setWorkstreams(""); setNextAction(""); setCompletionStandard(""); setStartOn(""); setDueOn(""); setScheduledFor("");
    } catch (cause) { showError(cause instanceof Error ? cause.message : "创建失败，请稍后重试。"); } finally { setSaving(false); }
  }

  return <ModalDialog open={open} onClose={close} labelledBy={titleId} className="form-dialog" initialFocusRef={titleRef}><form className="new-form" onSubmit={submit}><header><div><p className="eyebrow">NEW ACTION / ARM THE MISSION</p><h2 id={titleId}>新建事项</h2></div><button className="icon-button" type="button" onClick={close} aria-label="关闭新建事项"><CyberIcon name="close" /></button></header><label>事项名称<input ref={titleRef} value={title} onChange={(event) => setTitle(event.target.value)} required /></label><div className="field-grid"><label>任务范围<select value={actionArea} onChange={(event) => setActionArea(event.target.value)}><option value="project">项目</option><option value="personal">个人</option><option value="knowledge">知识库</option><option value="candidate">待归类</option></select></label><label>所属项目<select value={project} onChange={(event) => setProject(event.target.value)}><option value="">未归类</option>{projects.filter((item) => item.name !== "未归类").map((item) => <option key={item.name}>{item.name}</option>)}</select></label></div><label>工作流（用逗号分隔）<input value={workstreams} onChange={(event) => setWorkstreams(event.target.value)} /></label><label>下一动作<textarea value={nextAction} onChange={(event) => setNextAction(event.target.value)} required /></label><label>完成标准<textarea value={completionStandard} onChange={(event) => setCompletionStandard(event.target.value)} required /></label><fieldset className="date-window"><legend>执行窗口（可选）</legend><div className="date-window-grid"><label>开始日期<input type="date" value={startOn} onChange={(event) => setStartOn(event.target.value)} /></label><label>交付日期<input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} /></label><label>计划日期（留空进入 Backlog）<input type="date" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} /></label></div></fieldset><details><summary>高级设置</summary><label>资产范围<select value={assetScope} onChange={(event) => setAssetScope(event.target.value)}><option value="project">项目</option><option value="personal">个人</option><option value="organization">组织</option><option value="brand">品牌</option></select></label></details>{error ? <p ref={errorRef} className="form-error" role="alert" tabIndex={-1}>{error}</p> : null}<footer><button type="button" className="button secondary" onClick={close}><CyberIcon name="dismiss" />保留原状</button><button className="button primary" disabled={saving}><CyberIcon name="add" />{saving ? "正在建立…" : "建立事项"}</button></footer></form></ModalDialog>;
}
