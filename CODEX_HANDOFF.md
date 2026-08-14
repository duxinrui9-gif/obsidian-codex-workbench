# Vibe Mission Control — Codex 接入说明

这是一个面向本机 Obsidian Vault 的工作台源码包。开始前请先阅读 `README.md`、`docs/VAULT_CONTRACT.md` 和 `docs/handoff.md`。

## 必须遵守的接入顺序

1. 将源码解压到 Vault 之外的工作目录，运行 `pnpm install --frozen-lockfile`。
2. 复制 `.env.example` 为 `.env.local`，仅填写目标 Vault 的绝对路径；保持 `WORKBENCH_WRITE_ENABLED=false`。
3. 仅做只读盘点：`pnpm vault:inspect -- --vault="<目标 Vault 绝对路径>"`。该命令只输出目录计数、Markdown 数量和 Frontmatter 键名频率，不输出正文、字段值、绝对路径或附件内容。
4. 结合盘点结果和少量经用户授权的样例笔记，调整 `lib/vault-profile.ts` 中的路径、Properties 与状态映射。不要搬迁目录、批量补字段、覆盖模板或修改原始笔记。
5. 将目标 Vault 的副本或合成夹具用于验证。通过 `pnpm typecheck && pnpm lint && pnpm test && pnpm build` 后，以只读模式启动并检查工作台快照。
6. 只有用户明确确认后，才在 `.env.local` 把 `WORKBENCH_WRITE_ENABLED` 改为 `true`，并先在临时 Vault 验证一次新建、编辑和状态流转。

## 禁止事项

- 不读取、复制、打包或提交真实 Vault 内容、`.env.local`、备份、日志、浏览器状态或附件。
- 不在未确认前开启写入，不自动创建当前工作台的默认目录结构。
- 不根据猜测填充缺失 Properties；无法映射的语义必须明确报告为差异。

## 交付检查

最终交付前运行 `pnpm package:codex`。生成的 ZIP 和同名 `.sha256` 位于 `.workbench-data/releases`；发送前验证 SHA-256，并确认 ZIP 内没有 `.git`、`.env.local`、依赖目录、构建目录或任何真实 Vault 数据。
