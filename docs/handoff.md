# Handoff

## Current State

公开仓库已发布为 [`v0.1.0`](https://github.com/duxinrui9-gif/obsidian-codex-workbench/releases/tag/v0.1.0)。应用仍从仓库根目录以 `pnpm dev` 启动，默认只读并只绑定 `127.0.0.1`。它读取用户明确配置的 Vault，可从项目模板创建项目，并安全创建、更新和流转 `05_Review/Actions` 中的任务卡。

首页通过 `GET /api/workbench` 获取一次任务/项目快照。单个任务、项目或报告文件损坏时跳过并显示可打开的 Obsidian 降级告警；Vault 根目录或项目目录不可访问时才整体失败。

## Recent Changes

- 2026-08-14：以全新公开 Git 历史发布工作台、统一 Starter Vault、四个 Codex Skill、安装脚本和 CI。
- 写入门禁改为严格 opt-in：仅 `WORKBENCH_WRITE_ENABLED=true` 可写；缺失、`false` 或其他值均只读。
- pnpm 11 的运行时要求为 Node.js 22.13+；CI 使用 Node 22 和 Python 3.11。

## Open Items

- 当前本地文档收尾提交待用户确认后推送至 `origin/main`。
- 后续功能、Skill 或模板变更应在版本化提交后重新运行发布门禁。

## Risks / Notes

- `.env.local`、真实 Vault、`.workbench-data`、构建产物和日志都必须保持未提交。
- 图标成品在 `public/icons/cyber`；源图和浏览器截图仅位于 Git 忽略的 `.workbench-data/qa/icons`。
- 不添加公网监听、登录、遥测、定时器或文件监听；任何写入前先在临时 Vault 演练并取得用户确认。

## Key Entry Points

- `README.md`：本地启动与 Starter 初始化。
- `00_从这里开始.md`：交给接收方 Codex 的首条指令。
- `components/mission-control.tsx`：主驾驶舱和导航。
- `lib/vault.ts`：Vault 读取和任务安全写入。
- `lib/vault-profile.ts`：目录、字段、时区和只读写入映射。
- `scripts/bootstrap.sh`：安全创建 Starter Vault 与可选 Skill 安装。
- `scripts/build-release.sh`：从干净提交生成两个公开发布包。

## Verification

2026-08-14 已通过 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`（31 项测试）、`pnpm release:check`、四个 Skill 清单验证及 Starter Vault 审计（0 error / 0 warning）。[GitHub Actions CI](https://github.com/duxinrui9-gif/obsidian-codex-workbench/actions/runs/31816048170) 也已通过；发布包 SHA-256 已在 Release 中提供。

## History

版本历史见根目录 [`CHANGELOG.md`](../CHANGELOG.md)。本文件只保留下一次接手所需的当前事实。
