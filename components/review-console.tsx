"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { CyberIcon } from "@/components/cyber-icon";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ReviewKind, ReviewPeriod, ReviewRecord } from "@/lib/types";
import { hkMonth, monthDays, monthLabel, shiftMonth } from "@/lib/calendar";
import { VaultIssuesNotice } from "@/components/vault-issues-notice";
import type { ReviewIndexResponse, VaultIssue } from "@/lib/types";

function wikiText(value: string, vaultName: string): string {
  return value.replace(/<!--[^]*?-->/g, "").replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target: string, label?: string) => {
    const display = label || target.split("/").pop() || target;
    return `[${display}](obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(target)})`;
  });
}

function initialReview(reviews: ReviewRecord[]): ReviewRecord | null {
  const latest = reviews.find((review) => review.date);
  if (!latest) return reviews[0] ?? null;
  return reviews.find((review) => review.date === latest.date && review.kind === "report") ?? latest;
}


function ReviewReader({ selected, body, error, vaultName }: { selected: ReviewRecord | null; body: string; error: string; vaultName: string }) {
  return <article id="review-reader" className="review-reader" role="tabpanel" aria-labelledby={`review-tab-${selected?.kind ?? "report"}`}>{error ? <p className="form-error" role="alert">{error}</p> : null}{selected ? <><header><p className="eyebrow">READ ONLY / {selected.relativePath}</p><h2>{selected.title}</h2></header><ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={(url) => url.startsWith("obsidian:") ? url : defaultUrlTransform(url)} components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}<CyberIcon name="external-link" /></a> }}>{wikiText(body, vaultName)}</ReactMarkdown></> : <div className="empty-state"><strong>选择一份复盘文件</strong><span>报告正文会在这里以只读模式打开。</span></div>}</article>;
}

export function ReviewConsole({ period, vaultName }: { period: ReviewPeriod; vaultName: string }) {
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [selected, setSelected] = useState<ReviewRecord | null>(null);
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<ReviewKind>("report");
  const [month, setMonth] = useState(hkMonth);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<VaultIssue[]>([]);

  useEffect(() => { void fetch(`/api/reviews?period=${period}`, { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error("无法读取复盘文件"); return response.json() as Promise<ReviewIndexResponse>; }).then((data) => { const initial = initialReview(data.reviews); setReviews(data.reviews); setIssues(data.issues); setSelected(initial); setKind(initial?.kind ?? "report"); if (period === "daily" && initial?.date) setMonth(initial.date.slice(0, 7)); }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "无法读取复盘文件")); }, [period]);
  useEffect(() => { if (!selected) return; void fetch(`/api/reviews/${selected.id}`, { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error("无法读取报告正文"); return response.json() as Promise<ReviewRecord>; }).then((data) => setBody(data.body ?? "")).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "无法读取报告正文")); }, [selected]);

  const filtered = reviews.filter((item) => item.kind === kind);
  const dailyByDate = useMemo(() => new Map(reviews.filter((review) => review.date).map((review) => [`${review.date}:${review.kind}`, review])), [reviews]);
  const selectedDate = selected?.date ?? "";
  const chooseKind = (next: ReviewKind) => {
    setKind(next);
    const matching = selectedDate ? dailyByDate.get(`${selectedDate}:${next}`) : undefined;
    setSelected(matching ?? reviews.find((review) => review.kind === next) ?? null);
  };
  const chooseDate = (date: string) => {
    const review = dailyByDate.get(`${date}:report`) ?? dailyByDate.get(`${date}:plan`);
    if (review) { setSelected(review); setKind(review.kind); }
  };
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, current: ReviewKind) => { const next = event.key === "Home" ? "report" : event.key === "End" ? "plan" : event.key === "ArrowLeft" || event.key === "ArrowRight" ? current === "report" ? "plan" : "report" : null; if (next) { event.preventDefault(); chooseKind(next); requestAnimationFrame(() => document.getElementById(`review-tab-${next}`)?.focus()); } };
  const kindTabs = (hasReport = true, hasPlan = true) => <div className="tabs" role="tablist" aria-label="报告类型"><button id="review-tab-report" className={kind === "report" ? "active" : ""} onClick={() => chooseKind("report")} onKeyDown={(event) => onTabKey(event, "report")} disabled={!hasReport} role="tab" aria-selected={kind === "report"} aria-controls="review-reader" tabIndex={kind === "report" ? 0 : -1}><CyberIcon name="review-report" />报告</button><button id="review-tab-plan" className={kind === "plan" ? "active" : ""} onClick={() => chooseKind("plan")} onKeyDown={(event) => onTabKey(event, "plan")} disabled={!hasPlan} role="tab" aria-selected={kind === "plan"} aria-controls="review-reader" tabIndex={kind === "plan" ? 0 : -1}><CyberIcon name="review-plan" />规划</button></div>;

  if (period === "daily") {
    const hasReport = Boolean(selectedDate && dailyByDate.get(`${selectedDate}:report`));
    const hasPlan = Boolean(selectedDate && dailyByDate.get(`${selectedDate}:plan`));
    return <><VaultIssuesNotice issues={issues} vaultName={vaultName} /><div className="review-console daily-console"><aside className="review-index daily-index"><div className="calendar-head"><button className="icon-button" onClick={() => setMonth((value) => shiftMonth(value, -1))} aria-label="上个月">‹</button><strong>{monthLabel(month)}</strong><button className="icon-button" onClick={() => setMonth((value) => shiftMonth(value, 1))} aria-label="下个月">›</button></div><div className="calendar-weekdays">{["一", "二", "三", "四", "五", "六", "日"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{monthDays(month).map((date, index) => date ? <button key={date} className={`calendar-day ${date === selectedDate ? "calendar-selected" : ""} ${dailyByDate.has(`${date}:report`) || dailyByDate.has(`${date}:plan`) ? "calendar-active" : ""}`} disabled={!dailyByDate.has(`${date}:report`) && !dailyByDate.has(`${date}:plan`)} onClick={() => chooseDate(date)}><strong>{date.slice(-2)}</strong><span>{dailyByDate.has(`${date}:report`) ? "报" : ""}{dailyByDate.has(`${date}:plan`) ? "规" : ""}</span></button> : <span key={`empty-${index}`} className="calendar-empty" />)}</div>{kindTabs(hasReport, hasPlan)}<p className="quiet">有“报 / 规”标记的日期可打开；同日优先显示报告。</p></aside><ReviewReader selected={selected} body={body} error={error} vaultName={vaultName} /></div></>;
  }

  return <><VaultIssuesNotice issues={issues} vaultName={vaultName} /><div className="review-console"><aside className="review-index">{kindTabs()}<p className="eyebrow">ORBITAL ARCHIVE / {period.toUpperCase()}</p>{filtered.length ? filtered.map((review) => <button key={review.id} onClick={() => setSelected(review)} className={selected?.id === review.id ? "review-selected" : ""}><strong>{review.title}</strong><small>{review.date || review.periodEnd || "日期未标注"}{review.isLegacy ? " · 历史格式" : ""}</small></button>) : <p className="quiet">此舱位没有可读的{kind === "report" ? "报告" : "规划"}。</p>}</aside><ReviewReader selected={selected} body={body} error={error} vaultName={vaultName} /></div></>;
}
