import type { CSSProperties } from "react";

export const CYBER_ICON_NAMES = [
  "add", "brand-core", "carryover", "close", "dismiss", "external-link", "nav-command", "nav-daily", "nav-monthly", "nav-projects", "nav-tasks", "nav-weekly", "next-action", "overdue", "project-radar", "refresh", "review-plan", "review-report", "risk-watch", "save", "schedule", "state-backlog", "state-cancelled", "state-done", "state-in-progress", "state-ready", "state-review", "state-waiting", "theme-dark", "theme-light", "vault-disconnected", "vault-linked",
] as const;

export type CyberIconName = (typeof CYBER_ICON_NAMES)[number];

export function CyberIcon({ name, label, className = "" }: { name: CyberIconName; label?: string; className?: string }) {
  const accessible = Boolean(label);
  return <span className={`cyber-icon ${className}`} style={{ "--cyber-icon": `url(/icons/cyber/${name}.png)` } as CSSProperties} role={accessible ? "img" : undefined} aria-label={label} aria-hidden={accessible ? undefined : true} />;
}
