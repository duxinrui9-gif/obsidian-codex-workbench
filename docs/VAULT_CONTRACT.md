# Vault 数据契约

工作台将目标 Vault 映射为规范任务、项目和报告记录。目录、Properties 和状态映射集中在 `lib/vault-profile.ts`；默认值只适用于随包提供的合成夹具。

## 目录与时间

所有 `WORKBENCH_*_DIR`、项目模板和协作人模板都必须是 Vault 根目录内的相对路径，禁止绝对路径、`..` 和外部符号链接。日期、逾期判断和时钟使用 `WORKBENCH_TIME_ZONE`；浏览器显示使用相同的 `NEXT_PUBLIC_WORKBENCH_TIME_ZONE`。

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

`start_on` 是计划交付窗口的开始日，`due_on` 是承诺交付日，二者不会自动改变任务状态。任务日历将同时填写的两个日期作为首尾均包含的连续窗口；同一任务同日的日期角色合并显示。`scheduled_for` 始终表示下一次具体执行日，`review_on` 表示等待或确认的复查日。

## 项目与报告

- 项目页以文件名作为项目名，默认 `status` 可映射为 `active`、`review`、`archived` 或 `ignored`。新建项目要求模板中含 `{{title}}`、`{{date:YYYY-MM-DD}}`、`target_date:`、“目标与成功标准”和“下一步行动”。
- 日、周、月报告使用配置目录；报告日期优先读取 `date`，旧格式可从文件名或路径中的 `YYYY-MM-DD` 推断。日报类型使用 `daily_kind` 或 `review_kind` 的 `report` / `plan`。
- 新格式报告可在收口时记录 `metrics_as_of`、`metric_completed_actions`、`metric_carryover_events`、`metric_waiting_actions`、`metric_overdue_reviews`、`metric_overdue_deliveries`。空值表示未采集，绝不等同于零；非法值只产生降级告警，报告正文仍可读。周/月的完成与结转从日报汇总，等待与逾期风险取周期末快照。

## 协作人角色卡

协作人目录默认是 `03_Topics/人物`，只识别 `type: topic` 且 `topic_kind: collaborator_reference` 的笔记。稳定字段为 `aliases`、`relationship_roles`、`projects`、`collaboration_topics`、`source_notes` 和 `source_threads`，状态可为 `active`、`review`、`archived` 或 `ignored`。

工作台创建时要求姓名、至少一个关系角色，以及项目或协作主题之一；默认写入 `active`、`personal`、`restricted`、`observed`。编辑只更新稳定字段，不能修改姓名、路径、状态或正文；归档卡只读。不要在角色卡写联系方式、私人信息、临时评价或绩效判断。
- 映射前先盘点、后只读验证；不迁移现有笔记，不自动创建目录或模板。
