# Handoff

## Current State

Vibe Mission Control 已可在本机启动，读取 Obsidian Vault；可从项目模板创建项目，并安全创建、更新和流转 `05_Review/Actions` 中的任务卡。界面仅面向 1280px 以上的桌面浏览器。

首页通过 `GET /api/workbench` 获取一次任务/项目快照。单个任务、项目或报告文件损坏时跳过并显示可打开的 Obsidian 降级告警；Vault 根目录或项目目录不可访问时才整体失败。

## Recent Changes

- 历史变更见 [`CHANGELOG.md`](CHANGELOG.md)。
- Codex 接入包以只读 Profile 映射为起点；交付步骤见 [`../CODEX_HANDOFF.md`](../CODEX_HANDOFF.md)。

## Open Items

无。

## Risks / Notes

- `.env.local` 包含本机 Vault 路径，必须保持未提交。
- 图标成品在 `public/icons/cyber`；源图和浏览器截图仅位于 Git 忽略的 `.workbench-data/qa/icons`。
- `pnpm dev` 使用 webpack 并绑定 `127.0.0.1`；不要改为公网监听。

## Key Entry Points

- `components/mission-control.tsx`：主驾驶舱和导航。
- `components/cyber-icon.tsx`：类型安全的图标 mask 组件。
- `lib/vault.ts`：Vault 读取和任务安全写入。
- `lib/inputs.ts`：写入请求的运行时 JSON 与类型校验。
- `app/api/workbench/route.ts`：首页单次工作台快照。
- `components/action-drawer.tsx`：任务详情、状态流转及结转入口。
- `tests/vault.test.ts`：Vault 降级、项目聚合和串行写入验证。

## Verification

2026-08-14 已通过 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`（30 项测试）。Codex 接入包已在解压副本完成冻结依赖、全套验证、只读快照、写入 `403 WRITE_DISABLED` 与敏感文件检查；交付物必须始终由最终干净提交重新生成。
