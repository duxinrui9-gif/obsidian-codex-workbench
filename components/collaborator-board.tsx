"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CyberIcon } from "@/components/cyber-icon";
import { ModalDialog } from "@/components/modal-dialog";
import { obsidianOpenUri } from "@/lib/obsidian-uri";
import { rovingTabIndex } from "@/lib/roving-tabs";
import type { CollaboratorIndexResponse, CollaboratorPatch, CollaboratorRecord, CreateCollaboratorInput, ProjectSummary } from "@/lib/types";

type Group = "active" | "review" | "archived" | "unknown";

function listValue(value: string): string[] { return value.split(/[\n,，]/).map((item) => item.trim()).filter(Boolean); }
function displayProject(value: string): string { return value.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].split("/").pop() || value; }

export function CollaboratorBoard({ projects, writeEnabled, vaultName }: { projects: ProjectSummary[]; writeEnabled: boolean; vaultName: string }) {
  const [data, setData] = useState<CollaboratorIndexResponse | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [project, setProject] = useState("");
  const [group, setGroup] = useState<Group>("active");
  const [selected, setSelected] = useState<CollaboratorRecord | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    setError("");
    try {
      const response = await fetch("/api/collaborators", { cache: "no-store" });
      const value = await response.json() as CollaboratorIndexResponse & { error?: string };
      if (!response.ok) throw new Error(value.error ?? "无法读取协作人角色卡。");
      setData(value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "无法读取协作人角色卡。"); }
  };
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, []);

  const projectOptions = useMemo(() => [...new Set([...projects.map((item) => item.name), ...(data?.collaborators ?? []).flatMap((item) => item.projects.map(displayProject))])].filter(Boolean).sort((a, b) => a.localeCompare(b, "zh-Hans-CN")), [data, projects]);
  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return (data?.collaborators ?? []).filter((item) => {
      if (item.status !== group) return false;
      if (project && !item.projects.some((value) => displayProject(value) === project)) return false;
      if (!needle) return true;
      return [item.title, ...item.aliases, ...item.relationshipRoles, ...item.projects.map(displayProject), ...item.collaborationTopics].join(" ").toLocaleLowerCase().includes(needle);
    });
  }, [data, group, project, search]);
  const counts = (status: Group) => (data?.collaborators ?? []).filter((item) => item.status === status).length;
  const groups: Array<[Group, string]> = [["active", "使用中"], ["review", "待复核"], ["archived", "已归档"], ["unknown", "待确认"]];
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, current: Group) => { const next = rovingTabIndex(groups.findIndex(([status]) => status === current), event.key, groups.length); if (next !== null) { event.preventDefault(); setGroup(groups[next][0]); requestAnimationFrame(() => document.getElementById(`collaborator-tab-${groups[next][0]}`)?.focus()); } };

  if (error) return <div className="system-error"><strong>协作人加载失败</strong><span>{error}</span><button className="button secondary" onClick={() => void refresh()}>重新读取</button></div>;
  if (!data) return <div className="loading-grid" aria-label="正在读取协作人角色卡"><i /><i /></div>;
  if (!data.available) return <section className="empty-state collaborator-empty"><strong>未配置协作人目录</strong><span>Vault 中没有可读取的协作人目录。请先由 Obsidian 或管理员配置目录，工作台不会自动创建。</span></section>;
  return <div className="collaborator-board">
    <div className="panel-head"><div><p className="eyebrow">COLLABORATOR DIRECTORY / REFERENCE ONLY</p><h2>协作人</h2></div><button className="button primary" disabled={!writeEnabled} onClick={() => setCreating(true)}><CyberIcon name="add" />新建协作人</button></div>
    {data.issues.length ? <p className="collaborator-warning">发现 {data.issues.length} 张需要确认或无法读取的角色卡；其余卡片仍可正常查看。</p> : null}
    <div className="collaborator-tools"><label>搜索<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="姓名、别名、角色、项目或主题" /></label><label>项目<select value={project} onChange={(event) => setProject(event.target.value)}><option value="">全部项目</option>{projectOptions.map((item) => <option key={item}>{item}</option>)}</select></label></div>
    <div className="project-view-tabs" role="tablist" aria-label="协作人状态">{groups.map(([status, label]) => <button key={status} id={`collaborator-tab-${status}`} role="tab" aria-selected={group === status} aria-controls="collaborator-board-panel" tabIndex={group === status ? 0 : -1} className={group === status ? "active" : ""} onClick={() => setGroup(status)} onKeyDown={(event) => onTabKey(event, status)}>{label} {counts(status)}</button>)}</div>
    <div id="collaborator-board-panel" className="collaborator-grid" role="tabpanel" aria-labelledby={`collaborator-tab-${group}`}>{visible.map((item) => <button type="button" className="collaborator-card" key={item.id} onClick={() => setSelected(item)}><span className={`state collaborator-status state-${item.status}`}>{item.status === "active" ? "使用中" : item.status === "review" ? "待复核" : item.status === "archived" ? "已归档" : "待确认"}</span><strong>{item.title}</strong>{item.aliases.length ? <small>别名：{item.aliases.join("、")}</small> : null}<p>{item.relationshipRoles.join(" · ")}</p><div>{item.projects.map((value) => <em key={value}>{displayProject(value)}</em>)}{item.collaborationTopics.map((value) => <em key={value}>{value}</em>)}</div><small>更新：{item.updated || "未标注"}</small></button>)}{!visible.length ? <div className="empty-state"><strong>没有符合条件的协作人</strong><span>可调整状态、项目筛选或搜索词。</span></div> : null}</div>
    <NewCollaboratorForm open={creating} onClose={() => setCreating(false)} onCreated={(item) => { setData((current) => current ? { ...current, collaborators: [item, ...current.collaborators.filter((value) => value.id !== item.id)] } : current); setCreating(false); setSelected(item); }} />
    <CollaboratorDrawer item={selected} writeEnabled={writeEnabled} vaultName={vaultName} onClose={() => setSelected(null)} onSaved={(item) => { setData((current) => current ? { ...current, collaborators: current.collaborators.map((value) => value.id === item.id ? item : value) } : current); setSelected(item); }} />
  </div>;
}

function NewCollaboratorForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (item: CollaboratorRecord) => void }) {
  const [name, setName] = useState(""); const [roles, setRoles] = useState(""); const [projects, setProjects] = useState(""); const [topics, setTopics] = useState(""); const [aliases, setAliases] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const titleId = useId(); const nameRef = useRef<HTMLInputElement>(null);
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); setError(""); try { const payload: CreateCollaboratorInput = { name, aliases: listValue(aliases), relationshipRoles: listValue(roles), projects: listValue(projects), collaborationTopics: listValue(topics) }; const response = await fetch("/api/collaborators", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const item = await response.json() as CollaboratorRecord & { error?: string }; if (!response.ok) throw new Error(item.error ?? "创建失败"); onCreated(item); setName(""); setRoles(""); setProjects(""); setTopics(""); setAliases(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "创建失败"); } finally { setSaving(false); } }
  return <ModalDialog open={open} onClose={() => { setError(""); onClose(); }} labelledBy={titleId} className="form-dialog" initialFocusRef={nameRef}><form className="new-form" onSubmit={submit}><header><div><p className="eyebrow">NEW COLLABORATOR / STABLE REFERENCE</p><h2 id={titleId}>新建协作人</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><CyberIcon name="close" /></button></header><p className="quiet">仅记录稳定协作信息；不要填写联系方式、私人信息、临时评价或绩效判断。</p><label>姓名<input ref={nameRef} value={name} onChange={(event) => setName(event.target.value)} required /></label><label>关系角色（用逗号或换行分隔）<input value={roles} onChange={(event) => setRoles(event.target.value)} required /></label><label>关联项目（至少填写项目或协作主题之一）<input value={projects} onChange={(event) => setProjects(event.target.value)} /></label><label>协作主题<input value={topics} onChange={(event) => setTopics(event.target.value)} /></label><label>别名（可选）<input value={aliases} onChange={(event) => setAliases(event.target.value)} /></label>{error ? <p className="form-error" role="alert">{error}</p> : null}<footer><button type="button" className="button secondary" onClick={onClose}>取消</button><button className="button primary" disabled={saving}>{saving ? "正在建立…" : "建立角色卡"}</button></footer></form></ModalDialog>;
}

function CollaboratorDrawer({ item, writeEnabled, vaultName, onClose, onSaved }: { item: CollaboratorRecord | null; writeEnabled: boolean; vaultName: string; onClose: () => void; onSaved: (item: CollaboratorRecord) => void }) {
  const [aliases, setAliases] = useState(""); const [roles, setRoles] = useState(""); const [projects, setProjects] = useState(""); const [topics, setTopics] = useState(""); const [sources, setSources] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const titleId = useId(); const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { const timer = window.setTimeout(() => { if (item) { setAliases(item.aliases.join("、")); setRoles(item.relationshipRoles.join("、")); setProjects(item.projects.map(displayProject).join("、")); setTopics(item.collaborationTopics.join("、")); setSources(item.sourceNotes.join("、")); setError(""); } }, 0); return () => window.clearTimeout(timer); }, [item]);
  const readOnly = !writeEnabled || item?.status === "archived" || item?.status === "ignored";
  async function submit(event: React.FormEvent) { event.preventDefault(); if (!item) return; setSaving(true); setError(""); try { const payload: CollaboratorPatch = { expectedVersion: item.version, aliases: listValue(aliases), relationshipRoles: listValue(roles), projects: listValue(projects), collaborationTopics: listValue(topics), sourceNotes: listValue(sources) }; const response = await fetch(`/api/collaborators/${encodeURIComponent(item.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const next = await response.json() as CollaboratorRecord & { error?: string }; if (!response.ok) throw new Error(next.error ?? "保存失败"); onSaved(next); } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); } finally { setSaving(false); } }
  return <ModalDialog open={Boolean(item)} onClose={onClose} labelledBy={titleId} className="drawer" initialFocusRef={closeRef}>{item ? <form className="drawer-form" onSubmit={submit}><header><div><p className="eyebrow">COLLABORATOR ROLE CARD</p><h2 id={titleId}>{item.title}</h2></div><button ref={closeRef} className="icon-button" type="button" onClick={onClose} aria-label="关闭"><CyberIcon name="close" /></button></header><p className="quiet">姓名、文件路径、状态和正文由 Obsidian 管理；这里仅编辑稳定关联信息。</p><label>别名<input disabled={readOnly} value={aliases} onChange={(event) => setAliases(event.target.value)} /></label><label>关系角色<input disabled={readOnly} value={roles} onChange={(event) => setRoles(event.target.value)} /></label><label>关联项目<input disabled={readOnly} value={projects} onChange={(event) => setProjects(event.target.value)} /></label><label>协作主题<input disabled={readOnly} value={topics} onChange={(event) => setTopics(event.target.value)} /></label><label>来源笔记<input disabled={readOnly} value={sources} onChange={(event) => setSources(event.target.value)} /></label><a className="text-button" href={obsidianOpenUri(vaultName, item.relativePath)}>在 Obsidian 打开</a>{error ? <p className="form-error" role="alert">{error}</p> : null}<footer><button type="button" className="button secondary" onClick={onClose}>关闭</button>{!readOnly ? <button className="button primary" disabled={saving}>{saving ? "正在保存…" : "保存稳定信息"}</button> : <span className="readonly-mode">{item.status === "archived" ? "归档角色卡只读" : "只读接入"}</span>}</footer></form> : null}</ModalDialog>;
}
