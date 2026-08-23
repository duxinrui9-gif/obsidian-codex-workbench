import type { VaultIssue } from "@/lib/types";
import { obsidianOpenUri } from "@/lib/obsidian-uri";

const KIND: Record<VaultIssue["kind"], string> = { action: "事项", project: "项目", review: "报告", collaborator: "协作人" };

export function VaultIssuesNotice({ issues, vaultName }: { issues: VaultIssue[]; vaultName: string }) {
  if (!issues.length) return null;
  const skipped = issues.filter((issue) => !["INVALID_MARKDOWN_TABLE", "INVALID_REVIEW_METRIC"].includes(issue.code)).length;
  const readable = issues.length - skipped;
  const summary = skipped && readable ? `数据降级：${skipped} 个 Vault 文件已跳过，${readable} 个内容问题仍可读取` : skipped ? `数据降级：${skipped} 个 Vault 文件已跳过，其他内容仍可使用` : `数据提示：${readable} 个 Vault 内容问题仍可读取`;
  return <details className="vault-issues"><summary>{summary}</summary><ul>{issues.map((issue) => <li key={`${issue.kind}-${issue.relativePath}-${issue.code}`}><span>{KIND[issue.kind]} · {issue.code}</span><a href={obsidianOpenUri(vaultName, issue.relativePath)} target="_blank" rel="noreferrer">{issue.relativePath}</a><small>{issue.message}</small></li>)}</ul></details>;
}
