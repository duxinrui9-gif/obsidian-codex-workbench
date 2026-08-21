import type { ReviewRecord } from "@/lib/types";

function escaped(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export function visibleReviewBody(selected: ReviewRecord | null, body: string): string {
  return selected ? body.replace(new RegExp(`^\\s*#\\s+${escaped(selected.title)}\\s*(?:\\r?\\n)+`), "") : body;
}

export function reviewHeadingId(value: string): string {
  return `review-section-${value.trim().toLowerCase().replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, "$2$1").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "section"}`;
}
