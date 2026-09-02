# Obsidian Codex Workbench 新手使用指南

这份指南面向第一次使用 Codex、Obsidian 或 Git 的同事。推荐先让 Codex 帮你完成预检和安装；不需要先理解仓库代码。

## 先理解三件事

| 组成部分 | 用途 | 是否必须 |
| --- | --- | --- |
| Starter Vault | 一套空白、安全的 Obsidian 知识库目录和模板 | 是 |
| 四个 Codex Skill | 将资料入库、查询、体检和成熟度审计分开处理 | 是 |
| 本地工作台 | 浏览器中的任务与复盘界面 | 否 |

这个仓库不是会自动读取或改写全部历史笔记的插件。第一次请用新建的空白 Vault 或演示 Vault 练习，不要直接把真实历史资料交给它。

## 推荐路径：让 Codex 带你完成安装

1. 从 [Latest Release](https://github.com/duxinrui9-gif/obsidian-codex-workbench/releases/latest) 下载并解压完整包。
2. 在 Codex 新建一个任务，工作区选择解压后的仓库目录。
3. 将下面这段话完整复制给 Codex，并把尖括号中的目录替换为你准备好的、尚不存在或完全空白的 Vault 目录。

```text
请先阅读本仓库的 README.md、00_从这里开始.md 和 docs/BEGINNER-GUIDE.zh-CN.md。
我想在 <新的空白 Vault 目录> 使用 Obsidian Codex Workbench。
先只运行 scripts/bootstrap.sh 的 dry-run 预检，检查 Starter Vault 和四个 Skill 是否能安装；不要创建 Vault、不要覆盖任何目录、不要导入我的历史资料。
告诉我预检结果、将会创建什么、将会安装哪些 Skill，并等待我确认后再执行写入。
```

4. 预检通过后，确认 Codex 的说明无误，再复制：

```text
现在可以按刚才的预检结果创建 Starter Vault，并安装四个 Obsidian Skill。目标只能是 <新的空白 Vault 目录>；不要覆盖非空目录。完成后告诉我 Vault 路径、安装的 Skill 和验证结果。
```

5. 用 Obsidian 桌面端打开这个新 Vault，先阅读根目录的 [00_从这里开始.md](../00_从这里开始.md)。

首次安装不需要启动本地工作台，也不需要导入真实资料。

## 终端备用路径

如果你习惯终端，可在仓库根目录依次运行。第一条只预检，不会创建目录或写入文件；第二条才执行安装。

```bash
scripts/bootstrap.sh --vault "/你准备的新空白 Vault 目录" --install-skills
scripts/bootstrap.sh --vault "/你准备的新空白 Vault 目录" --apply --install-skills
```

目标目录已存在且不是空目录时，脚本会拒绝覆盖。这是正常保护，不要删除已有笔记来强行继续。

## 四个 Skill 怎么用

安装完成后请新建一个 Codex 任务。新任务会重新加载已安装的 Skill；旧任务的可用 Skill 列表可能不会即时更新。

| Skill | 适合做什么 | 默认是否写入 Vault |
| --- | --- | --- |
| `obsidian-ingest` | 把你明确指定的文章、会议纪要、PDF 或网页资料整理为可追溯知识 | 会写入，但仅处理你指定的输入 |
| `obsidian-query` | 从知识库中回答问题，并给出笔记路径和证据状态 | 否 |
| `obsidian-health-check` | 检查目录、属性、链接、哈希和知识契约问题 | 否，只报告 |
| `obsidian-maturity-audit` | 检查知识卡是否有独立证据和实践验证，是否适合升级或归档 | 否，只报告 |

可以直接复制下面的示例。`<...>` 是你需要替换的内容。

```text
$obsidian-ingest 将 <文件或公开 URL> 整理进 <Vault 路径>。先说明将创建或更新哪些笔记和证据，再执行；不要处理其他资料。
```

```text
$obsidian-query 在 <Vault 路径> 查询“<我的问题>”。只读回答，列出引用笔记、路径和证据状态，不保存查询记录。
```

```text
$obsidian-health-check 检查 <Vault 路径>。只生成报告，不自动修复；按 fatal、error、warning 和建议分类。
```

```text
$obsidian-maturity-audit 审计 <Vault 路径> 中与“<主题>”相关的知识卡。只报告成熟度、缺少的证据和下一步，不移动或修改笔记。
```

成功的第一次演练应当是：你能打开 Starter Vault、读懂一份演示笔记，并完成一次只读查询或体检。不要以“自动修改很多笔记”为成功标准。

## 何时允许写入

- 资料入库：你明确点名了输入资料和目标 Vault 时，`obsidian-ingest` 可以写入。
- 查询、体检和成熟度审计：默认只读。只有你明确说“修复”“应用”“归档”或“保存记录”时，才允许执行对应写入。
- 项目页可以被读取和引用为证据，但默认不修改。
- 不确定时，先要求 Codex 输出 dry-run 或变更清单。

## 可选：启动本地工作台

本地工作台只适合你已经熟悉 Starter Vault 后使用。它需要 Node.js `22.13+` 和 pnpm `11`，并且只应在本机运行。

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
```

打开 `.env.local`，填入你的 Vault 路径，并保留：

```dotenv
WORKBENCH_WRITE_ENABLED=false
```

然后启动：

```bash
pnpm dev
```

浏览器打开终端提示的本地地址，通常是 `http://127.0.0.1:3000`。写入开关保持关闭时，不能点击写入是预期行为，不是故障。

## 常见问题

### 目标目录不是空的

安装脚本拒绝覆盖是为了保护笔记。请换一个全新目录，或先让 Codex 只读检查现有 Vault，而不是直接运行安装。

### 同名 Skill 无法安装

这表示你的 Codex 已有同名版本。先让 Codex 比较现有版本与本仓库版本；确认需要升级后，再使用安装脚本的替换模式。不要手动删除 Skill 目录。

### Codex 看不到四个 Skill

确认安装命令完成且目标是 `~/.codex/skills`，然后新建一个 Codex 任务再试。已有任务通常不会动态刷新 Skill 列表。

### 工作台页面为空或报路径错误

检查 `.env.local` 中的 Vault 路径是否存在、是否指向你实际打开的 Vault。先保持 `WORKBENCH_WRITE_ENABLED=false`，确认只读页面正常后再讨论写入权限。

### 没有 Node.js 或 pnpm

这不影响 Starter Vault 和四个 Skill。先走推荐路径使用 Obsidian 与 Codex；需要本地工作台时，再安装 Node.js `22.13+` 与 pnpm `11`。

## 简明词汇

- **Vault**：Obsidian 管理的一组 Markdown 笔记和附件目录。
- **Skill**：给 Codex 的可复用工作说明，不是独立应用。
- **Properties**：Obsidian 笔记顶部的结构化字段，用于标记类型、来源和状态。
- **只读**：允许检查、检索和报告，但不会创建、移动或修改笔记。

更具体的目录与 Skill 安装说明见 [packages/obsidian-skills/START-HERE.md](../packages/obsidian-skills/START-HERE.md)。
