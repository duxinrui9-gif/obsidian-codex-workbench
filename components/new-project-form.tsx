"use client";

import { useId, useRef, useState } from "react";
import { CyberIcon } from "@/components/cyber-icon";
import { ModalDialog } from "@/components/modal-dialog";
import type { CreateProjectInput, ProjectSummary } from "@/lib/types";

export function NewProjectForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (project: ProjectSummary) => void }) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  function showError(message: string) {
    setError(message);
    window.requestAnimationFrame(() => errorRef.current?.focus());
  }

  function close() {
    setError("");
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const payload: CreateProjectInput = { name, goal, successCriteria, nextAction, targetDate };
      const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as ProjectSummary & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "创建失败");
      onCreated(data);
      setName(""); setGoal(""); setSuccessCriteria(""); setNextAction(""); setTargetDate("");
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "创建失败，请稍后重试。");
    } finally { setSaving(false); }
  }

  return <ModalDialog open={open} onClose={close} labelledBy={titleId} className="form-dialog" initialFocusRef={nameRef}><form className="new-form" onSubmit={submit}><header><div><p className="eyebrow">NEW PROJECT / ESTABLISH MISSION</p><h2 id={titleId}>新建项目</h2></div><button className="icon-button" type="button" onClick={close} aria-label="关闭新建项目"><CyberIcon name="close" /></button></header><label>项目名称<input ref={nameRef} value={name} onChange={(event) => setName(event.target.value)} required /></label><label>目标<textarea value={goal} onChange={(event) => setGoal(event.target.value)} required /></label><label>成功标准<textarea value={successCriteria} onChange={(event) => setSuccessCriteria(event.target.value)} required /></label><label>下一步行动<textarea value={nextAction} onChange={(event) => setNextAction(event.target.value)} required /></label><label>目标日期（可选）<input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></label>{error ? <p ref={errorRef} className="form-error" role="alert" tabIndex={-1}>{error}</p> : null}<footer><button type="button" className="button secondary" onClick={close}><CyberIcon name="dismiss" />保留原状</button><button className="button primary" disabled={saving}><CyberIcon name="add" />{saving ? "正在建立…" : "建立项目"}</button></footer></form></ModalDialog>;
}
