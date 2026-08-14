import { parseDocument } from "yaml";
import { AppError } from "@/lib/errors";

export interface FrontmatterDocument {
  yaml: ReturnType<typeof parseDocument>;
  body: string;
}

export function splitFrontmatter(raw: string): FrontmatterDocument {
  if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) {
    throw new AppError("文件缺少 YAML Properties。", 422, "FRONTMATTER_REQUIRED");
  }
  const normalized = raw.replace(/\r\n/g, "\n");
  const closing = normalized.indexOf("\n---\n", 4);
  if (closing === -1) {
    throw new AppError("YAML Properties 未正确结束。", 422, "FRONTMATTER_INVALID");
  }
  const source = normalized.slice(4, closing + 1);
  const yaml = parseDocument(source);
  if (yaml.errors.length > 0) {
    throw new AppError(`YAML Properties 无法读取：${yaml.errors[0].message}`, 422, "FRONTMATTER_INVALID");
  }
  return { yaml, body: normalized.slice(closing + 5) };
}

export function stringifyFrontmatter(document: FrontmatterDocument): string {
  return `---\n${document.yaml.toString()}---\n${document.body}`;
}

export function getString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/^"|"$/g, "");
}

export function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(getString).filter(Boolean);
}
