# Obsidian Codex Workbench

一个本地运行的 Obsidian 工作台与知识库起步包：将任务卡、日报、周/月复盘、项目页、证据化知识整理和 Codex Skill 放在同一套可验证的发行中。

它包含：

- 本地个人工作台：读取 Obsidian 中的任务、项目和复盘，默认只读；
- `starter-vault`：`00 → 01 → 02` 知识链路与日报系统的统一空白模板；
- 四个 Codex Skill：资料整理、知识库查询、结构体检和成熟度审计；
- 安全初始化、发布打包与 CI 校验脚本。

> 本项目只适用于本机单用户环境。它不包含登录、多租户、云同步或公网部署能力。不要把开发服务暴露到局域网或公网。

## 本地启动

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
# 编辑 .env.local：填写你自己的 Vault 路径，保持 WORKBENCH_WRITE_ENABLED=false
pnpm dev
```

打开 `http://127.0.0.1:3000`。首次只验证读取；在临时 Vault 完成新建、编辑和状态流转演练，并获得用户明确确认后，才将 `WORKBENCH_WRITE_ENABLED` 改为 `true`。

## 创建新的 Vault

```bash
scripts/bootstrap.sh --vault "$HOME/Documents/My Obsidian Starter"
scripts/bootstrap.sh --vault "$HOME/Documents/My Obsidian Starter" --apply --install-skills
```

第一条命令只预检。第二条命令只会创建不存在或为空的目录；如发现同名已安装 Skill，会停止而不是覆盖。详见 [00_从这里开始.md](00_从这里开始.md) 与 [Codex onboarding](docs/CODEX-ONBOARDING.md)。

## 日常维护

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm release:check
python3 packages/obsidian-skills/verify.py
```

真实 Vault、`.env.local`、`.workbench-data`、构建产物、日志和浏览器状态均被 Git 忽略，不能进入提交或发布包。

## English quick start

1. Install Node 22.13+ and pnpm 11.
2. Run `pnpm install --frozen-lockfile`.
3. Copy `.env.example` to `.env.local`, set your Vault path, and keep writes disabled.
4. Run `pnpm dev`; the server listens only on `127.0.0.1`.
5. Create a new template Vault with `scripts/bootstrap.sh --vault <empty-path> --apply --install-skills`.

Read the full English onboarding guide at [docs/QUICKSTART.en.md](docs/QUICKSTART.en.md).

## License

MIT. See [LICENSE](LICENSE). The included cyber icon assets are distributed under the same license.
