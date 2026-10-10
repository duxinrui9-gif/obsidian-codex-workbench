# 行动关系与 Bases

只检查结构和证据，不自动创建关系、改变优先级或关闭任务。Query 可以读取并解释关系；日报按用户指定输入与授权更新托管区；Ingest 不因抓到一个任务描述就修改行动卡，Maturity 不负责行动状态。

## 可选 Properties

```yaml
parent_action: "[[05_Review/Actions/ACT-YYYYMMDD-NNN 父任务]]"
subactions: ["[[05_Review/Actions/ACT-YYYYMMDD-NNN 子任务]]"]
depends_on: ["[[05_Review/Actions/ACT-YYYYMMDD-NNN 前置任务]]"]
```

这是格式示例，不直接复制为实际关系。`parent_action` 为单个笔记 Wiki link 或空字符串，另两项为内联列表；引用必须唯一解析到 Vault 内 `type: action`。遗留卡缺少这些字段仍有效；不批量补字段。层级与依赖不同，子任务不必依赖父任务完成；父子关系也不决定重要/紧急等级。

审核范围：不存在、歧义、非行动目标、自引用和循环为结构 error；重复边、显式父子记录冲突、已完成父任务仍有开放子任务、已完成事项前置任务未完成为人工复核 warning。仅单侧记录时不擅自补另一侧；两侧都有声明才核对一致性。明确取消的前置项不等于已完成，须用户确认替代路径。

父任务完成以自身 `completion_standard` 和 `completion_evidence` 为准。一个子任务完成不能自动关闭父任务；全部子任务完成也只是支持证据，仍需核验父任务交付。可选或取消分支是否不再阻塞须有明确决定；不按子任务计数生成机械完成百分比。

## 规划未知与验证

对会影响当前决策的未知，分别记录影响、证据可信度、验证成本和选择是否可逆，再决定先验证哪项。不把低可信度当低价值，不用普通先后顺序冒充关键路径；用户锁定的重要/紧急判断不覆盖。缺证保留待判断，推荐实验或资料核实，不自动实施或淘汰。

## Bases 使用

既有待办和周任务 `.base` 只增加 `depends_on` 的显示名与列，不改全局/视图 filters、公式、周界限或七种状态。Properties 的标准库审计不是完整 YAML/Bases 解析器；另用已有 YAML 工具检查语法，再在 Obsidian 原生界面检验公式与显示。无原生验收就明确未验证，不能以 YAML 通过声称视图正常。

## 来源与改造

- Kepano `obsidian-bases`，commit `3ccff5338ea700537839b21900aa5358a0402c98`，[源码](https://github.com/kepano/obsidian-skills/tree/3ccff5338ea700537839b21900aa5358a0402c98/skills/obsidian-bases)，Copyright 2026 Steph Ango，MIT：[许可证](licenses/kepano-obsidian.LICENSE)。只吸收视图、属性与原生验证规范，不安装 CLI、插件或替换 v4。
- PM Skills `prioritization-frameworks`、`prioritize-assumptions`，commit `5924541d18009ec3380671027c93f8d914e4eb20`，[源码](https://github.com/phuryn/pm-skills/tree/5924541d18009ec3380671027c93f8d914e4eb20)，Copyright 2026 Pawel Huryn，MIT：[许可证](licenses/pm-skills.LICENSE)。只参考影响、可信度、验证成本与可逆性；不使用尺度不一致的 `(1 - Confidence) * Effort`、万能权重、自动拒绝/执行或固定分数取代个人规划规则。
