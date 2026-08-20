import type { VaultIssue } from "@/lib/types";

const KIND: Record<VaultIssue["kind"], string> = { action: "事项", project: "项目", review: "报告", collaborator: "协作人" };

export function VaultIssuesNotice({ issues, vaultName }: { issues: VaultIssue[]; vaultName: string }) {
  if (!issues.length) return null;
  return <details className="vault-issues"><summary>数据降级：{issues.length} 个 Vault 文件已跳过，其他内容仍可使用</summary><ul>{issues.map((issue) => <li key={`${issue.kind}-${issue.relativePath}`}><span>{KIND[issue.kind]} · {issue.code}</span><a href={`obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(issue.relativePath)}`} target="_blank" rel="noreferrer">{issue.relativePath}</a><small>{issue.message}</small></li>)}</ul></details>;
}
