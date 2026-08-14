---
type: source
status: review
created: "{{date:YYYY-MM-DD}}"
updated: "{{date:YYYY-MM-DD}}"
source_kind: pdf_primary_learning_trial
captured: "{{date:YYYY-MM-DD}}"
source_url: ""
source_unavailable_reason: ""
content_hash: ""
asset_scope: personal
sensitivity: internal
evidence_status: observed
source_contract: semantic-content-v4
source_adapter: document
source_role: content
content_modalities: [text, visual]
source_inputs: []
evidence_families: []
coverage_status: partial
coverage_verified: false
coverage_check: pending
semantic_check: pending
visual_check: pending
content_fidelity: full
fidelity_check: pending
content_unit_scheme: page-element-v1
visual_unit_scheme: page-region-v2
compilation_mode: pdf-primary-learning-v1
narrative_unit_scheme: topic-argument-v1
primary_speaker: ""
learning_check: pending
anti_summary_check: pending
acceptance_status: pending
tags: []
---

# {{title}}

> 以 PDF 的可见材料为骨架，用同场、同讲者的口述补足推理和现场情境。正文服务连续学习；审计附录保存输入、页码、时间码和机器证据。本稿在用户验收前不得进入 02。

> [!info]- 讲者与材料背景
> 只保留理解本稿所需的讲者背景；不要让人物履历打断核心论证。

## 学习正文

> 按主题、论证、步骤和案例组织，不按页码拆章节。完整保留有意义的字段、数字、角色、表格、节点、箭头、截图状态、案例动作与限制。已知讲者用姓名归因；幻灯片可见内容直接描述。页码和时间码进入合并脚注，机器证据标签留在附录。

## 来源与处理附录

### 原始输入清单

| input_id | 原件或快照 | 适配器 | 处理范围 | SHA-256 | 采集时间 | 访问状态 |
| --- | --- | --- | --- | --- | --- | --- |
| I1 |  | document |  |  |  |  |

### 覆盖附录

| input_id | 覆盖单位 | 应覆盖范围 | 正文去向 | 明确排除 | 未解决内容 |
| --- | --- | --- | --- | --- | --- |
| I1 | 页面/时间段 |  | [[#^c-i1-p001-01]] |  |  |

### 页面覆盖表

| input_id | PDF页码 | 页面角色 | 内容单元ID | 视觉单元ID | 正文块 | 明确排除 | 未解决内容 |
| --- | --- | --- | --- | --- | --- | --- |
| I1 | 1 |  | C001 |  | [[#^c-i1-p001-01]] |  |  |

### 内容单元清单

| unit_id | PDF页码 | 内容类型 | 原件内容范围 | 正文块 | 视觉块 | 处理状态 | 排除理由 | 未解决内容 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C001 | 1 | 标题/正文/表格/图表/流程/截图/案例 | 具体可辨认信息 | [[#^c-i1-p001-01]] |  | transcribed |  |  |

### 视觉证据清单

| visual_id | 页码与区域 | 视觉类型 | 附件 | SHA-256 | 可见事实 | 论证作用 | 证据性质 | 正文块 | 识别状态 | 限制 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V1 | p.1 r.01 | 图表/流程/截图 |  |  | 具体标签、数值、箭头、字段与状态 | 如何支持或限制本页论证 | visual-observation | [[#^c-i1-p001-01]] | recognized |  |

### 证据映射

| 证据ID | 读者定位 | 机器证据性质 | 输入与精确位置 | 证据家族 | 限制 |
| --- | --- | --- | --- | --- | --- |
| E1 | 脚注说明 | visual-observation/speaker-claim/case-result |  |  |  |

## 验收清单

- [ ] 正文可连续阅读，且没有把结构化内容压缩为泛化总结。
- [ ] 每个 PDF 页和转写时间段都进入附录或有明确排除理由。
- [ ] 页面、内容单元、视觉和正文锚点可双向定位。
- [ ] 重要冲突、案例非结果和材料缺口在正文可见。
