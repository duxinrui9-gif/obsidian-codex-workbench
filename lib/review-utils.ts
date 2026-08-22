import type { ReviewRecord } from "@/lib/types";

function escaped(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export function visibleReviewBody(selected: ReviewRecord | null, body: string): string {
  return selected ? body.replace(new RegExp(`^\\s*#\\s+${escaped(selected.title)}\\s*(?:\\r?\\n)+`), "") : body;
}

export function reviewHeadingId(value: string): string {
  return `review-section-${value.trim().toLowerCase().replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, "$2$1").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "section"}`;
}

export interface MarkdownTableIssue {
  line: number;
  headerColumns: number;
  separatorColumns: number;
}

function tableCells(value: string): string[] {
  const trimmed = value.trim();
  const cells: string[] = [];
  let current = "";
  let escaped = false;
  const content = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const row = content.endsWith("|") ? content.slice(0, -1) : content;

  for (const character of row) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === "\\") {
      current += character;
      escaped = true;
    } else if (character === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells;
}

function isTableSeparator(value: string): boolean {
  if (!value.includes("|")) return false;
  const cells = tableCells(value);
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

export function malformedMarkdownTables(body: string): MarkdownTableIssue[] {
  const lines = body.split(/\r?\n/);
  const issues: MarkdownTableIssue[] = [];
  let fence = "";

  for (let index = 0; index < lines.length - 1; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0];
      else if (fence === fenceMatch[1][0]) fence = "";
      continue;
    }
    if (fence || !line.includes("|") || !isTableSeparator(lines[index + 1])) continue;

    const headerColumns = tableCells(line).length;
    const separatorColumns = tableCells(lines[index + 1]).length;
    if (headerColumns !== separatorColumns) {
      issues.push({ line: index + 2, headerColumns, separatorColumns });
    }
  }
  return issues;
}
