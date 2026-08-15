# Vault 数据契约

工作台将目标 Vault 映射为规范任务、项目和报告记录。目录、Properties 和状态映射集中在 `lib/vault-profile.ts`；默认值只适用于随包提供的合成夹具。

## 目录与时间

所有 `WORKBENCH_*_DIR` 和 `WORKBENCH_PROJECT_TEMPLATE` 都必须是 Vault 根目录内的相对路径，禁止绝对路径、`..` 和外部符号链接。日期、逾期判断和时钟使用 `WORKBENCH_TIME_ZONE`；浏览器显示使用相同的 `NEXT_PUBLIC_WORKBENCH_TIME_ZONE`。

## 规范任务

| 语义 | 默认 Property | 必需 |
| --- | --- | --- |
| 唯一标识 | `action_id`，格式 `ACT-YYYYMMDD-NNN` | 是 |
| 状态 | `action_state` | 是 |
| 文件生命周期 | `status`，`active` / `archived` | 是 |
| 范围、项目、下一动作、完成标准 | `action_area`、`projects`、`next_action`、`completion_standard` | 写入时需要 |
| 交付窗口 | `start_on`、`due_on` | 可选；两者同时填写时开始日不得晚于交付日 |
| 排期、复查、关闭 | `scheduled_for`、`review_on`、`closed_at`、`closed_reason` | 按状态需要 |

规范状态为 `ready`、`in_progress`、`waiting`、`backlog`、`review`、`done`、`cancelled`。目标 Vault 使用其他字段名或值时，在 Profile 中改映射；缺少对应语义时保持只读并报告差异。

`start_on` 是计划交付窗口的开始日，`due_on` 是承诺交付日，二者不会自动改变任务状态。`scheduled_for` 始终表示下一次具体执行日，`review_on` 表示等待或确认的复查日。

## 项目与报告

- 项目页以文件名作为项目名，默认 `status` 可映射为 `active`、`review`、`archived` 或 `ignored`。新建项目要求模板中含 `{{title}}`、`{{date:YYYY-MM-DD}}`、`target_date:`、“目标与成功标准”和“下一步行动”。
- 日、周、月报告使用配置目录；报告日期优先读取 `date`，旧格式可从文件名或路径中的 `YYYY-MM-DD` 推断。日报类型使用 `daily_kind` 或 `review_kind` 的 `report` / `plan`。
- 映射前先盘点、后只读验证；不迁移现有笔记，不自动创建目录或模板。
