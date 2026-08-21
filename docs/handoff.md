# Handoff

## Current State

远端 `main` 包含当前工作台功能；[`v0.1.0`](https://github.com/duxinrui9-gif/obsidian-codex-workbench/releases/tag/v0.1.0) 仍是最近发布标签，尚未创建新 Release。应用从仓库根目录以 `pnpm dev` 启动，默认只读并只绑定 `127.0.0.1`。它读取用户明确配置的 Vault，可从模板创建项目，并安全创建、更新和流转 `05_Review/Actions` 中的任务卡。

首页通过 `GET /api/workbench` 获取一次任务/项目快照。单个任务、项目或报告文件损坏时跳过并显示可打开的 Obsidian 降级告警；Vault 根目录或项目目录不可访问时才整体失败。任务的 `start_on`、`due_on`、`scheduled_for` 与 `review_on` 已完整接入：交付窗口在日历中按自然日连续显示，同日多个日期角色合并为一张任务卡，繁忙日期按项目和紧迫度组织。

报告阅读器支持未来报告写入的冻结指标和二、三级标题目录；没有指标的历史报告不做补零或反推。协作人板块按需读取 `03_Topics/人物` 中的角色卡，不纳入首页扫描；仅在写入开关开启时允许创建或编辑稳定字段，正文、姓名、路径和状态始终由 Obsidian 管理。

## Recent Changes

- 2026-08-14：以全新公开 Git 历史发布工作台、统一 Starter Vault、四个 Codex Skill、安装脚本和 CI。
- 写入门禁改为严格 opt-in：仅 `WORKBENCH_WRITE_ENABLED=true` 可写；缺失、`false` 或其他值均只读。
- pnpm 11 的运行时要求为 Node.js 22.13+；CI 使用 Node 22 和 Python 3.11。
- 2026-08-16：新增任务交付窗口字段、真实日期验证与连续任务日历，忙碌日期按项目和紧迫度组织。
- 2026-08-21：新增协作人角色卡的惰性读取与受限写入；报告阅读器支持冻结指标、目录、项目筛选与证据标签，并同步未来报告模板与 Starter Vault。
- 2026-08-21：补齐合成日报、周报、月报示例与周期复盘 playbook；打包的 `obsidian-health-check` 现在校验角色卡契约、任务窗口顺序、可选报告指标和可用模板。

## Open Items

- 保持 `WORKBENCH_WRITE_ENABLED=false`，直到在临时 Vault 中验证映射和写入流程，并获得用户明确授权。

## Risks / Notes

- `.env.local`、真实 Vault、`.workbench-data`、构建产物和日志都必须保持未提交。
- `pnpm dev` 和 `pnpm build` 会切换 `next-env.d.ts` 的生成引用；若开发服务正在运行，保留该文件的本机改动且不要随功能提交。
- 图标成品在 `public/icons/cyber`；源图和浏览器截图仅位于 Git 忽略的 `.workbench-data/qa/icons`。
- 不添加公网监听、登录、遥测、定时器或文件监听；任何写入前先在临时 Vault 演练并取得用户确认。

## Key Entry Points

- `README.md`：本地启动与 Starter 初始化。
- `00_从这里开始.md`：交给接收方 Codex 的首条指令。
- `components/mission-control.tsx`：主驾驶舱和导航。
- `components/task-board.tsx`、`lib/task-board.ts`：任务日历、连续窗口、同日聚合与项目优先级。
- `components/collaborator-board.tsx`、`app/api/collaborators/`：协作人角色卡的惰性加载与受限编辑。
- `components/review-console.tsx`：只读报告的冻结指标、目录、项目筛选与证据标签。
- `lib/vault.ts`：Vault 读取和任务、项目、协作人安全写入。
- `lib/vault-profile.ts`：目录、字段、时区和只读写入映射。
- `scripts/bootstrap.sh`：安全创建 Starter Vault 与可选 Skill 安装。
- `scripts/build-release.sh`：从干净提交生成两个公开发布包。

## Verification

2026-08-21 已通过完整 TypeScript、lint、测试、构建、发布检查、Skill manifest/包校验及 Starter Vault 健康审计。在真实配置 Vault 的只读模式下，仅验证协作人读取与报告索引，不对真实 Vault 发起协作人写入。`v0.1.0` 的发布包 SHA-256 仅对应该历史标签；主分支后续改动尚未发布为新版本。

## History

版本历史见根目录 [`CHANGELOG.md`](../CHANGELOG.md)。本文件只保留下一次接手所需的当前事实。
