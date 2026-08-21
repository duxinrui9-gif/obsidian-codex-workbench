import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AppError } from "@/lib/errors";
import { getString, getStringArray, splitFrontmatter, stringifyFrontmatter } from "@/lib/frontmatter";
import { assertIsoDate, assertSafeId } from "@/lib/security";
import { actionStateFromSource, actionStateToSource, projectStatusFromSource, projectStatusToSource, vaultProfile, workbenchWriteEnabled } from "@/lib/vault-profile";
import {
  ACTION_STATES,
  type ActionArea,
  type ActionPatch,
  type ActionRecord,
  type ActionState,
  type AssetScope,
  type CollaboratorPatch,
  type CollaboratorRecord,
  type CollaboratorStatus,
  type CreateCollaboratorInput,
  type CreateActionInput,
  type CreateProjectInput,
  type HealthResponse,
  type ProjectSummary,
  type ProjectStatus,
  type ProjectTransitionInput,
  type ReviewKind,
  type ReviewPeriod,
  type ReviewRecord,
  type TransitionInput,
  type VaultIssue,
  type VaultIssueKind,
  type WorkbenchSnapshot,
} from "@/lib/types";

const ALLOWED_AREAS: ActionArea[] = ["project", "personal", "knowledge", "candidate"];
const ALLOWED_SCOPES: AssetScope[] = ["personal", "organization", "project", "brand"];

declare global {
  var __vibeActionWriteLocks: Map<string, Promise<void>> | undefined;
  var __vibeCollaboratorWriteLocks: Map<string, Promise<void>> | undefined;
  var __vibeProjectWriteLocks: Map<string, Promise<void>> | undefined;
}

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: vaultProfile().timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function vaultRoot(): Promise<string> {
  const configured = process.env.OBSIDIAN_VAULT_PATH;
  if (!configured) throw new AppError("尚未配置 OBSIDIAN_VAULT_PATH。", 503, "VAULT_NOT_CONFIGURED");
  try {
    const real = await fs.realpath(configured);
    const stat = await fs.stat(real);
    if (!stat.isDirectory()) throw new Error("not a directory");
    return real;
  } catch {
    throw new AppError("无法访问配置的 Obsidian Vault。", 503, "VAULT_UNAVAILABLE");
  }
}

async function safeDirectory(relative: string): Promise<string> {
  const root = await vaultRoot();
  const candidate = path.resolve(root, relative);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    throw new AppError("请求路径超出了 Vault 范围。", 403, "PATH_OUTSIDE_VAULT");
  }
  const real = await fs.realpath(candidate);
  if (real !== root && !real.startsWith(`${root}${path.sep}`)) {
    throw new AppError("Vault 内的符号链接指向了外部位置。", 403, "SYMLINK_OUTSIDE_VAULT");
  }
  return real;
}

async function requiredDirectory(relative: string, code: string, message: string): Promise<string> {
  try {
    return await safeDirectory(relative);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new AppError(message, 503, code);
    throw error;
  }
}

async function markdownFiles(relative: string): Promise<string[]> {
  let root: string;
  try {
    root = await safeDirectory(relative);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const files: string[] = [];
  async function walk(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const filePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await walk(filePath);
      if (entry.isFile() && entry.name.endsWith(".md")) files.push(filePath);
    }
  }
  await walk(root);
  return files.sort();
}

function toWikiProject(name: string): string {
  return name.startsWith("[[") ? name : `[[${vaultProfile().paths.projects}/${name}]]`;
}

function projectName(value: string): string {
  const target = value.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0];
  return target.split("/").pop() ?? target;
}

function validateDeliveryWindow(startOn: string, dueOn: string): void {
  try {
    if (startOn) assertIsoDate(startOn, "开始日期");
    if (dueOn) assertIsoDate(dueOn, "交付日期");
  } catch (error) {
    if (error instanceof AppError && error.code === "INVALID_DATE") throw new AppError(error.message, 422, "INVALID_INPUT");
    throw error;
  }
  if (startOn && dueOn && startOn > dueOn) {
    throw new AppError("开始日期不能晚于交付日期。", 422, "INVALID_INPUT");
  }
}

function parseAction(raw: string, absolutePath: string, root: string): ActionRecord {
  const { yaml, body } = splitFrontmatter(raw);
  const values = yaml.toJS() as Record<string, unknown>;
  const fields = vaultProfile().properties.action;
  const id = getString(values[fields.id]);
  assertSafeId(id);
  const actionState = actionStateFromSource(getString(values[fields.state]));
  if (!actionState) throw new AppError(`任务 ${id} 的状态无效。`, 422, "INVALID_ACTION_STATE");
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(absolutePath, ".md").replace(/^ACT-\d{8}-\d{3}\s*/, "");
  return {
    id,
    title,
    relativePath: path.relative(root, absolutePath),
    version: hash(raw),
    status: getString(values[fields.status]) === "archived" ? "archived" : "active",
    actionState,
    actionArea: getString(values[fields.area]) as ActionArea,
    created: getString(values[fields.created]),
    updated: getString(values[fields.updated]),
    lastActivity: getString(values[fields.lastActivity]),
    startOn: getString(values[fields.startOn]),
    dueOn: getString(values[fields.dueOn]),
    scheduledFor: getString(values[fields.scheduledFor]),
    reviewOn: getString(values[fields.reviewOn]),
    closedAt: getString(values[fields.closedAt]),
    assetScope: getString(values[fields.assetScope]) as AssetScope,
    sensitivity: getString(values[fields.sensitivity]),
    evidenceStatus: getString(values[fields.evidenceStatus]),
    projects: getStringArray(values[fields.projects]),
    workstreams: getStringArray(values[fields.workstreams]),
    nextAction: getString(values[fields.nextAction]),
    completionStandard: getString(values[fields.completionStandard]),
    carryoverCount: Number(values[fields.carryoverCount] ?? 0),
    sourceNotes: getStringArray(values[fields.sourceNotes]),
    sourceThreads: getStringArray(values[fields.sourceThreads]),
    completionEvidence: getStringArray(values[fields.completionEvidence]),
    closedReason: getString(values[fields.closedReason]),
    body,
  };
}

type ReadResult<T> = { items: T[]; issues: VaultIssue[] };

function isVaultGuide(file: string): boolean {
  return ["README.md", "00 使用说明.md", "00 项目索引.md"].includes(path.basename(file));
}

function vaultIssue(kind: VaultIssueKind, file: string, root: string, error: unknown): VaultIssue {
  const appError = error instanceof AppError ? error : undefined;
  return {
    kind,
    relativePath: path.relative(root, file),
    code: appError?.code ?? "FILE_PARSE_FAILED",
    message: appError?.message ?? "此文件无法解析，已跳过。",
  };
}

async function readMarkdownItems<T>(kind: VaultIssueKind, relative: string, parse: (raw: string, file: string, root: string) => T | null): Promise<ReadResult<T>> {
  const root = await vaultRoot();
  const files = await markdownFiles(relative);
  const items: T[] = [];
  const issues: VaultIssue[] = [];
  for (const file of files) {
    if (isVaultGuide(file)) continue;
    try {
      const item = parse(await fs.readFile(file, "utf8"), file, root);
      if (item) items.push(item);
    } catch (error) {
      issues.push(vaultIssue(kind, file, root, error));
    }
  }
  return { items, issues };
}

export async function readActions(): Promise<ActionRecord[]> {
  return (await readActionsWithIssues()).items;
}

export async function readActionsWithIssues(): Promise<ReadResult<ActionRecord>> {
  const result = await readMarkdownItems("action", vaultProfile().paths.actions, parseAction);
  result.items.sort((a, b) => b.updated.localeCompare(a.updated) || a.title.localeCompare(b.title, "zh-Hans-CN"));
  return result;
}

async function actionLocation(id: string): Promise<string> {
  assertSafeId(id);
  const files = await markdownFiles(vaultProfile().paths.actions);
  const match = files.find((file) => path.basename(file).startsWith(`${id} `));
  if (!match) throw new AppError("找不到该任务卡。", 404, "ACTION_NOT_FOUND");
  return match;
}

export async function getAction(id: string): Promise<ActionRecord> {
  const root = await vaultRoot();
  const file = await actionLocation(id);
  return parseAction(await fs.readFile(file, "utf8"), file, root);
}

function validateArea(value: ActionArea): ActionArea {
  if (!ALLOWED_AREAS.includes(value)) throw new AppError("任务范围无效。", 422, "INVALID_ACTION_AREA");
  return value;
}

function validateScope(value: AssetScope): AssetScope {
  if (!ALLOWED_SCOPES.includes(value)) throw new AppError("资产范围无效。", 422, "INVALID_ASSET_SCOPE");
  return value;
}

function validateText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new AppError(`请填写${label}。`, 422, "FIELD_REQUIRED");
  if (trimmed.length > 600) throw new AppError(`${label}不能超过 600 个字符。`, 422, "FIELD_TOO_LONG");
  return trimmed;
}

function validateProjectName(value: string): string {
  const name = validateText(value, "项目名称");
  if (name.length > 120 || name === "." || name === ".." || name.startsWith(".") || /[\\/:*?"<>|]/.test(name)) {
    throw new AppError("项目名称不能包含文件路径字符。", 422, "INVALID_PROJECT_NAME");
  }
  return name;
}

function validateCollaboratorName(value: string): string {
  const name = validateText(value, "协作人姓名");
  if (name.length > 120 || name === "." || name === ".." || name.startsWith(".") || /[\\/:*?"<>|]/.test(name)) {
    throw new AppError("协作人姓名不能包含文件路径字符。", 422, "INVALID_COLLABORATOR_NAME");
  }
  return name;
}

function validateList(values: string[], label: string, required = false): string[] {
  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (required && !normalized.length) throw new AppError(`请至少填写一项${label}。`, 422, "FIELD_REQUIRED");
  if (normalized.some((value) => value.length > 160)) throw new AppError(`${label}不能超过 160 个字符。`, 422, "FIELD_TOO_LONG");
  return normalized;
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function statusLog(body: string, state: ActionState, note: string): string {
  const line = `| ${today()} | ${state} | ${note.replace(/\|/g, "／").replace(/\n/g, " ")} |`;
  if (/## 状态记录\s*\n\s*\| 日期 \| 状态 \| 记录 \|\s*\n\s*\| --- \| --- \| --- \|/m.test(body)) {
    return body.replace(/(## 状态记录\s*\n\s*\| 日期 \| 状态 \| 记录 \|\s*\n\s*\| --- \| --- \| --- \|[^\n]*\n(?:\|[^\n]*\n)*)/m, (section) => `${section}${line}\n`);
  }
  return `${body.trimEnd()}\n\n## 状态记录\n\n| 日期 | 状态 | 记录 |\n| --- | --- | --- |\n${line}\n`;
}

async function backupAndWrite(file: string, raw: string, next: string): Promise<void> {
  const backupDirectory = path.join(process.cwd(), ".workbench-data", "backups");
  await fs.mkdir(backupDirectory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await fs.writeFile(path.join(backupDirectory, `${path.basename(file)}.${stamp}.${randomUUID()}.bak`), raw, "utf8");
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  await fs.writeFile(temporary, next, "utf8");
  await fs.rename(temporary, file);
}

function actionWriteLocks(): Map<string, Promise<void>> {
  globalThis.__vibeActionWriteLocks ??= new Map<string, Promise<void>>();
  return globalThis.__vibeActionWriteLocks;
}

async function withActionWriteLock<T>(id: string, operation: () => Promise<T>): Promise<T> {
  const locks = actionWriteLocks();
  const previous = locks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => gate);
  locks.set(id, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (locks.get(id) === tail) locks.delete(id);
  }
}

async function withActionCreateLock<T>(operation: () => Promise<T>): Promise<T> {
  return withActionWriteLock("__action-create__", operation);
}

async function writeMutation(
  id: string,
  expectedVersion: string,
  change: (document: ReturnType<typeof splitFrontmatter>, current: ActionRecord) => void,
): Promise<ActionRecord> {
  assertSafeId(id);
  return withActionWriteLock(id, async () => {
    const root = await vaultRoot();
    const file = await actionLocation(id);
    const raw = await fs.readFile(file, "utf8");
    const current = parseAction(raw, file, root);
    if (!expectedVersion || current.version !== expectedVersion) {
      throw new AppError("任务卡已被 Obsidian 或其他窗口修改。请刷新后再保存。", 409, "VERSION_CONFLICT");
    }
    const document = splitFrontmatter(raw);
    change(document, current);
    const next = stringifyFrontmatter(document);
    await backupAndWrite(file, raw, next);
    return parseAction(next, file, root);
  });
}

export async function patchAction(id: string, patch: ActionPatch): Promise<ActionRecord> {
  return writeMutation(id, patch.expectedVersion, (document, current) => {
    if (current.status === "archived") throw new AppError("已结束任务仅供查看，不能再修改。", 422, "ARCHIVED_ACTION_READ_ONLY");
    const props = document.yaml;
    const fields = vaultProfile().properties.action;
    if (patch.actionArea !== undefined) props.set(fields.area, validateArea(patch.actionArea));
    if (patch.projects !== undefined) props.set(fields.projects, patch.projects.filter(Boolean).map(toWikiProject));
    if (patch.workstreams !== undefined) props.set(fields.workstreams, patch.workstreams.filter(Boolean).map((item) => item.trim()));
    if (patch.nextAction !== undefined) props.set(fields.nextAction, validateText(patch.nextAction, "下一动作"));
    if (patch.completionStandard !== undefined) props.set(fields.completionStandard, validateText(patch.completionStandard, "完成标准"));
    if (patch.assetScope !== undefined) props.set(fields.assetScope, validateScope(patch.assetScope));
    const startOn = patch.startOn ?? current.startOn;
    const dueOn = patch.dueOn ?? current.dueOn;
    validateDeliveryWindow(startOn, dueOn);
    if (patch.startOn !== undefined) props.set(fields.startOn, patch.startOn);
    if (patch.dueOn !== undefined) props.set(fields.dueOn, patch.dueOn);
    if (patch.scheduledFor !== undefined) {
      if (patch.scheduledFor) assertIsoDate(patch.scheduledFor, "计划日期");
      props.set(fields.scheduledFor, patch.scheduledFor);
    }
    if (patch.reviewOn !== undefined) {
      if (patch.reviewOn) assertIsoDate(patch.reviewOn, "复查日期");
      props.set(fields.reviewOn, patch.reviewOn);
    }
    props.set(fields.updated, today());
    props.set(fields.lastActivity, today());
    if (current.actionState === "waiting" && !getString(props.get(fields.reviewOn))) {
      throw new AppError("等待状态必须有复查日期。", 422, "WAITING_REVIEW_REQUIRED");
    }
  });
}

export async function transitionAction(id: string, input: TransitionInput): Promise<ActionRecord> {
  return writeMutation(id, input.expectedVersion, (document, current) => {
    if (current.status === "archived") throw new AppError("已结束任务仅供查看，不能再流转。", 422, "ARCHIVED_ACTION_READ_ONLY");
    const props = document.yaml;
    const fields = vaultProfile().properties.action;
    const permitted: Record<TransitionInput["transition"], ActionState[]> = {
      start: ["ready", "backlog", "waiting", "review"],
      wait: ["in_progress"],
      complete: ["in_progress"],
      schedule: ["ready", "backlog", "waiting", "review", "in_progress"],
      carryover: ["ready", "backlog", "waiting", "review", "in_progress"],
      cancel: ACTION_STATES.filter((state) => state !== "done" && state !== "cancelled"),
    };
    if (!permitted[input.transition].includes(current.actionState)) {
      throw new AppError("该任务当前状态不允许此操作。", 422, "INVALID_STATE_TRANSITION");
    }
    let state: ActionState;
    const reviewOn = input.reviewOn;
    if (input.transition === "wait" && !reviewOn) {
      throw new AppError("等待状态必须填写复查日期。", 422, "WAITING_REVIEW_REQUIRED");
    }
    const requiresNote = input.transition === "wait" || input.transition === "complete" || input.transition === "cancel";
    const note = requiresNote
      ? validateText(input.note ?? "", "状态说明")
      : (input.note?.trim() || "通过 Vibe Mission Control 更新状态。");
    if (input.transition === "start") state = "in_progress";
    else if (input.transition === "wait") {
      state = "waiting";
      assertIsoDate(reviewOn!, "复查日期");
      props.set(fields.reviewOn, reviewOn!);
    } else if (input.transition === "schedule") {
      state = "ready";
      if (!input.scheduledFor) throw new AppError("排期需要填写计划日期。", 422, "SCHEDULE_REQUIRED");
      assertIsoDate(input.scheduledFor, "计划日期");
      props.set(fields.scheduledFor, input.scheduledFor);
    } else if (input.transition === "carryover") {
      state = input.scheduledFor ? "ready" : "backlog";
      if (input.scheduledFor) {
        assertIsoDate(input.scheduledFor, "计划日期");
      }
      props.set(fields.scheduledFor, input.scheduledFor ?? "");
      props.set(fields.carryoverCount, current.carryoverCount + 1);
    } else if (input.transition === "complete") {
      state = "done";
      props.set(fields.closedAt, today());
      props.set(fields.closedReason, note);
      props.set(fields.nextAction, "");
    } else {
      state = "cancelled";
      props.set(fields.closedAt, today());
      props.set(fields.closedReason, note);
      props.set(fields.nextAction, "");
    }
    props.set(fields.state, actionStateToSource(state));
    props.set(fields.status, state === "done" || state === "cancelled" ? "archived" : "active");
    props.set(fields.updated, today());
    props.set(fields.lastActivity, today());
    document.body = statusLog(document.body, state, note);
  });
}

export async function createAction(input: CreateActionInput): Promise<ActionRecord> {
  const title = validateText(input.title, "事项名称");
  if (/[\\/:*?"<>|]/.test(title)) throw new AppError("事项名称不能包含文件路径字符。", 422, "INVALID_TITLE");
  const actionArea = validateArea(input.actionArea);
  const nextAction = validateText(input.nextAction, "下一动作");
  const completionStandard = validateText(input.completionStandard, "完成标准");
  validateDeliveryWindow(input.startOn ?? "", input.dueOn ?? "");
  if (input.scheduledFor) assertIsoDate(input.scheduledFor, "计划日期");
  const fields = vaultProfile().properties.action;
  return withActionCreateLock(async () => {
    const directory = await safeDirectory(vaultProfile().paths.actions);
    const state: ActionState = input.scheduledFor ? "ready" : "backlog";
    const scope = input.assetScope ? validateScope(input.assetScope) : actionArea === "project" ? "project" : "personal";
    const project = input.project?.trim() ? [toWikiProject(input.project.trim())] : [];
    const prefix = `ACT-${today().replaceAll("-", "")}-`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const files = await markdownFiles(vaultProfile().paths.actions);
      const sequence = Math.max(0, ...files.map((file) => Number(path.basename(file).match(new RegExp(`^${prefix}(\\d{3})`))?.[1] ?? 0))) + 1;
      const id = `${prefix}${String(sequence).padStart(3, "0")}`;
      const content = `---\ntype: action\n${fields.status}: active\n${fields.id}: ${id}\n${fields.state}: ${actionStateToSource(state)}\n${fields.area}: ${actionArea}\n${fields.created}: ${today()}\n${fields.updated}: ${today()}\n${fields.lastActivity}: ${today()}\n${fields.startOn}: ${input.startOn ?? ""}\n${fields.dueOn}: ${input.dueOn ?? ""}\n${fields.scheduledFor}: ${input.scheduledFor ?? ""}\n${fields.reviewOn}: \"\"\n${fields.closedAt}: \"\"\n${fields.assetScope}: ${scope}\n${fields.sensitivity}: restricted\n${fields.evidenceStatus}: inferred\n${fields.projects}: ${JSON.stringify(project)}\n${fields.workstreams}: ${JSON.stringify((input.workstreams ?? []).filter(Boolean))}\n${fields.nextAction}: ${JSON.stringify(nextAction)}\n${fields.completionStandard}: ${JSON.stringify(completionStandard)}\n${fields.carryoverCount}: 0\n${fields.sourceNotes}: []\n${fields.sourceThreads}: []\n${fields.completionEvidence}: []\n${fields.closedReason}: \"\"\nmigration_batch: action-ledger-web-mvp\n---\n\n# ${title}\n\n## 状态记录\n\n| 日期 | 状态 | 记录 |\n| --- | --- | --- |\n| ${today()} | ${actionStateToSource(state)} | 通过 Vibe Mission Control 新建事项。 |\n`;
      const file = path.join(directory, `${id} ${title}.md`);
      try {
        await fs.writeFile(file, content, { encoding: "utf8", flag: "wx" });
        const root = await vaultRoot();
        return parseAction(content, file, root);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
    throw new AppError("新建事项编号发生并发冲突，请稍后重试。", 409, "ACTION_CREATE_CONFLICT");
  });
}

async function projectTemplate(): Promise<string> {
  const root = await vaultRoot();
  const file = path.resolve(root, vaultProfile().paths.projectTemplate);
  const real = await fs.realpath(file).catch(() => "");
  if (!real || !real.startsWith(`${root}${path.sep}`)) throw new AppError("找不到项目主页模板。", 422, "PROJECT_TEMPLATE_MISSING");
  const raw = await fs.readFile(real, "utf8");
  const required = ["{{title}}", "{{date:YYYY-MM-DD}}", "target_date:", "## 目标与成功标准", "## 下一步行动"];
  if (!required.every((marker) => raw.includes(marker))) {
    throw new AppError("项目主页模板结构不符合要求。", 422, "PROJECT_TEMPLATE_INVALID");
  }
  return raw;
}

export async function createProject(input: CreateProjectInput): Promise<ProjectSummary> {
  const name = validateProjectName(input.name);
  const goal = oneLine(validateText(input.goal, "项目目标"));
  const successCriteria = oneLine(validateText(input.successCriteria, "成功标准"));
  const nextAction = oneLine(validateText(input.nextAction, "下一步行动"));
  if (input.targetDate) assertIsoDate(input.targetDate, "目标日期");
  const root = await vaultRoot();
  const directory = await safeDirectory(vaultProfile().paths.projects);
  const pages = await readProjects();
  if (pages.some((project) => project.name.localeCompare(name, "zh-Hans-CN", { sensitivity: "accent" }) === 0)) {
    throw new AppError("同名项目已经存在。", 409, "PROJECT_EXISTS");
  }
  const template = await projectTemplate();
  const content = template
    .replaceAll("{{date:YYYY-MM-DD}}", today())
    .replace("{{title}}", name)
    .replace('target_date: ""', `target_date: ${JSON.stringify(input.targetDate ?? "")}`)
    .replace(/(## 目标与成功标准\s*\n\s*)- 目标：\s*\n- 成功标准：\s*\n/, `$1- 目标：${goal}\n- 成功标准：${successCriteria}\n`)
    .replace(/(## 下一步行动\s*\n\s*)- \[ \]\s*/, `$1- [ ] ${nextAction}\n`);
  const file = path.join(directory, `${name}.md`);
  try {
    await fs.writeFile(file, content, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new AppError("同名项目已经存在。", 409, "PROJECT_EXISTS");
    throw error;
  }
  return {
    id: Buffer.from(path.relative(root, file)).toString("base64url"),
    name,
    wikiLink: toWikiProject(name),
    relativePath: path.relative(root, file),
    version: hash(content),
    updated: today(),
    status: "active",
    hasProjectPage: true,
    activeCount: 0,
    overdueCount: 0,
    waitingCount: 0,
    inProgressCount: 0,
    overdueDeliveryCount: 0,
    tasks: [],
    doneTasks: [],
    cancelledTasks: [],
    doneCount: 0,
    cancelledCount: 0,
  };
}

async function collaboratorDirectory(): Promise<string | null> {
  try {
    return await safeDirectory(vaultProfile().paths.collaborators);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function collaboratorStatus(value: string): CollaboratorStatus {
  return projectStatusFromSource(value || projectStatusToSource("active"));
}

function parseCollaborator(raw: string, absolutePath: string, root: string): CollaboratorRecord | null {
  const { yaml, body } = splitFrontmatter(raw);
  const values = yaml.toJS() as Record<string, unknown>;
  const fields = vaultProfile().properties.collaborator;
  if (getString(values[fields.type]) !== "topic" || getString(values[fields.kind]) !== "collaborator_reference") return null;
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(absolutePath, ".md");
  return {
    id: Buffer.from(path.relative(root, absolutePath)).toString("base64url"),
    title,
    relativePath: path.relative(root, absolutePath),
    version: hash(raw),
    status: collaboratorStatus(getString(values[fields.status])),
    created: getString(values[fields.created]),
    updated: getString(values[fields.updated]),
    assetScope: getString(values[fields.assetScope]) as AssetScope,
    sensitivity: getString(values[fields.sensitivity]),
    evidenceStatus: getString(values[fields.evidenceStatus]),
    aliases: getStringArray(values[fields.aliases]),
    relationshipRoles: getStringArray(values[fields.relationshipRoles]),
    projects: getStringArray(values[fields.projects]),
    collaborationTopics: getStringArray(values[fields.collaborationTopics]),
    sourceNotes: getStringArray(values[fields.sourceNotes]),
    sourceThreads: getStringArray(values[fields.sourceThreads]),
    body,
  };
}

export async function readCollaboratorsWithIssues(): Promise<ReadResult<CollaboratorRecord> & { available: boolean }> {
  const directory = await collaboratorDirectory();
  if (!directory) return { items: [], issues: [], available: false };
  const root = await vaultRoot();
  const files = await markdownFiles(vaultProfile().paths.collaborators);
  const items: CollaboratorRecord[] = [];
  const issues: VaultIssue[] = [];
  for (const file of files) {
    if (isVaultGuide(file)) continue;
    try {
      const record = parseCollaborator(await fs.readFile(file, "utf8"), file, root);
      if (!record) continue;
      if (record.status === "unknown") issues.push({ kind: "collaborator", relativePath: record.relativePath, code: "INVALID_COLLABORATOR_STATUS", message: "协作人状态无效，已按待确认显示。" });
      items.push(record);
    } catch (error) {
      issues.push(vaultIssue("collaborator", file, root, error));
    }
  }
  items.sort((a, b) => b.updated.localeCompare(a.updated) || a.title.localeCompare(b.title, "zh-Hans-CN"));
  return { items, issues, available: true };
}

export async function readCollaborators(): Promise<CollaboratorRecord[]> {
  return (await readCollaboratorsWithIssues()).items;
}

function collaboratorRelativePath(id: string): string {
  const decoded = Buffer.from(id, "base64url").toString("utf8");
  const directory = vaultProfile().paths.collaborators;
  if (!decoded.startsWith(`${directory}/`) || !decoded.endsWith(".md")) throw new AppError("协作人标识无效。", 400, "INVALID_COLLABORATOR_ID");
  return decoded;
}

async function collaboratorLocation(id: string): Promise<string> {
  const decoded = collaboratorRelativePath(id);
  const root = await vaultRoot();
  const file = path.resolve(root, decoded);
  const real = await fs.realpath(file).catch(() => "");
  if (!real) throw new AppError("找不到该协作人角色卡。", 404, "COLLABORATOR_NOT_FOUND");
  if (!real.startsWith(`${root}${path.sep}`)) throw new AppError("协作人角色卡路径超出 Vault 范围。", 403, "PATH_OUTSIDE_VAULT");
  return real;
}

export async function getCollaborator(id: string): Promise<CollaboratorRecord> {
  const root = await vaultRoot();
  const file = await collaboratorLocation(id);
  const record = parseCollaborator(await fs.readFile(file, "utf8"), file, root);
  if (!record) throw new AppError("该文件不是协作人角色卡。", 404, "COLLABORATOR_NOT_FOUND");
  return record;
}

function collaboratorWriteLocks(): Map<string, Promise<void>> {
  globalThis.__vibeCollaboratorWriteLocks ??= new Map<string, Promise<void>>();
  return globalThis.__vibeCollaboratorWriteLocks;
}

async function withCollaboratorWriteLock<T>(id: string, operation: () => Promise<T>): Promise<T> {
  const locks = collaboratorWriteLocks();
  const previous = locks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => gate);
  locks.set(id, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (locks.get(id) === tail) locks.delete(id);
  }
}

async function collaboratorTemplate(): Promise<string> {
  const root = await vaultRoot();
  const file = path.resolve(root, vaultProfile().paths.collaboratorTemplate);
  const real = await fs.realpath(file).catch(() => "");
  if (!real || !real.startsWith(`${root}${path.sep}`)) throw new AppError("找不到协作人角色卡模板。", 422, "COLLABORATOR_TEMPLATE_MISSING");
  const raw = await fs.readFile(real, "utf8");
  const required = ["topic_kind: collaborator_reference", "relationship_roles:", "collaboration_topics:"];
  if (!required.every((marker) => raw.includes(marker)) || (!raw.includes("{{title}}") && !/^#\s+协作人姓名\s*$/m.test(raw))) throw new AppError("协作人角色卡模板结构不符合要求。", 422, "COLLABORATOR_TEMPLATE_INVALID");
  return raw;
}

function applyCollaboratorProperties(document: ReturnType<typeof splitFrontmatter>, input: Omit<CreateCollaboratorInput, "name"> | CollaboratorPatch): void {
  const fields = vaultProfile().properties.collaborator;
  const props = document.yaml;
  if (input.aliases !== undefined) props.set(fields.aliases, validateList(input.aliases, "别名"));
  if (input.relationshipRoles !== undefined) props.set(fields.relationshipRoles, validateList(input.relationshipRoles, "协作角色", true));
  if (input.projects !== undefined) props.set(fields.projects, validateList(input.projects, "关联项目").map(toWikiProject));
  if (input.collaborationTopics !== undefined) props.set(fields.collaborationTopics, validateList(input.collaborationTopics, "协作主题"));
  if (input.sourceNotes !== undefined) props.set(fields.sourceNotes, validateList(input.sourceNotes, "来源笔记"));
  if (input.sourceThreads !== undefined) props.set(fields.sourceThreads, validateList(input.sourceThreads, "来源任务"));
  const projects = getStringArray(props.get(fields.projects));
  const topics = getStringArray(props.get(fields.collaborationTopics));
  if (!projects.length && !topics.length) throw new AppError("请至少填写一个关联项目或协作主题。", 422, "COLLABORATOR_CONTEXT_REQUIRED");
}

export async function createCollaborator(input: CreateCollaboratorInput): Promise<CollaboratorRecord> {
  const name = validateCollaboratorName(input.name);
  const directory = await collaboratorDirectory();
  if (!directory) throw new AppError("尚未配置协作人目录，不能新建角色卡。", 422, "COLLABORATOR_DIRECTORY_UNAVAILABLE");
  const template = await collaboratorTemplate();
  const document = splitFrontmatter(template.replaceAll("{{date:YYYY-MM-DD}}", today()).replaceAll("{{title}}", name).replace(/^#\s+协作人姓名\s*$/m, `# ${name}`));
  const fields = vaultProfile().properties.collaborator;
  document.yaml.set(fields.type, "topic");
  document.yaml.set(fields.kind, "collaborator_reference");
  document.yaml.set(fields.status, "active");
  document.yaml.set(fields.created, today());
  document.yaml.set(fields.updated, today());
  document.yaml.set(fields.assetScope, "personal");
  document.yaml.set(fields.sensitivity, "restricted");
  document.yaml.set(fields.evidenceStatus, "observed");
  applyCollaboratorProperties(document, input);
  const content = stringifyFrontmatter(document);
  const file = path.join(directory, `${name}.md`);
  try {
    await fs.writeFile(file, content, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new AppError("同名协作人角色卡已经存在。", 409, "COLLABORATOR_EXISTS");
    throw error;
  }
  const root = await vaultRoot();
  const record = parseCollaborator(content, file, root);
  if (!record) throw new AppError("协作人角色卡创建失败。", 500, "COLLABORATOR_CREATE_FAILED");
  return record;
}

export async function patchCollaborator(id: string, patch: CollaboratorPatch): Promise<CollaboratorRecord> {
  collaboratorRelativePath(id);
  return withCollaboratorWriteLock(id, async () => {
    const root = await vaultRoot();
    const file = await collaboratorLocation(id);
    const raw = await fs.readFile(file, "utf8");
    const current = parseCollaborator(raw, file, root);
    if (!current) throw new AppError("该文件不是协作人角色卡。", 404, "COLLABORATOR_NOT_FOUND");
    if (current.status === "archived" || current.status === "ignored") throw new AppError("已结束协作人角色卡仅供查看，不能再修改。", 422, "ARCHIVED_COLLABORATOR_READ_ONLY");
    if (!patch.expectedVersion || patch.expectedVersion !== current.version) throw new AppError("协作人角色卡已被 Obsidian 或其他窗口修改。请刷新后再保存。", 409, "VERSION_CONFLICT");
    const document = splitFrontmatter(raw);
    applyCollaboratorProperties(document, patch);
    document.yaml.set(vaultProfile().properties.collaborator.updated, today());
    const next = stringifyFrontmatter(document);
    await backupAndWrite(file, raw, next);
    const record = parseCollaborator(next, file, root);
    if (!record) throw new AppError("协作人角色卡更新失败。", 500, "COLLABORATOR_UPDATE_FAILED");
    return record;
  });
}

function inferReviewKind(values: Record<string, unknown>, relativePath: string, title: string): { kind: ReviewKind; legacy: boolean } {
  const fields = vaultProfile().properties.review;
  const direct = getString(values[fields.kind] || values[fields.legacyKind]) as ReviewKind;
  if (direct === "plan" || direct === "report") return { kind: direct, legacy: false };
  return { kind: /计划|规划|\/Plan\//.test(`${relativePath} ${title}`) ? "plan" : "report", legacy: true };
}

function metricValue(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function reviewMetrics(values: Record<string, unknown>): ReviewRecord["metrics"] {
  const fields = vaultProfile().properties.review;
  const metrics = {
    asOf: getString(values[fields.metricsAsOf]),
    completedActions: metricValue(values[fields.completedActions]),
    carryoverEvents: metricValue(values[fields.carryoverEvents]),
    waitingActions: metricValue(values[fields.waitingActions]),
    overdueReviews: metricValue(values[fields.overdueReviews]),
    overdueDeliveries: metricValue(values[fields.overdueDeliveries]),
  };
  return Object.values(metrics).some((value) => value !== "" && value !== null) ? metrics : null;
}

function invalidReviewMetric(values: Record<string, unknown>): boolean {
  const fields = vaultProfile().properties.review;
  return [fields.completedActions, fields.carryoverEvents, fields.waitingActions, fields.overdueReviews, fields.overdueDeliveries].some((field) => {
    const value = values[field];
    return value !== undefined && value !== null && value !== "" && metricValue(value) === null;
  });
}

function parseReview(raw: string, absolutePath: string, root: string, period: ReviewPeriod): ReviewRecord {
  const { yaml, body } = splitFrontmatter(raw);
  const values = yaml.toJS() as Record<string, unknown>;
  const fields = vaultProfile().properties.review;
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(absolutePath, ".md");
  const inferred = inferReviewKind(values, path.relative(root, absolutePath), title);
  return {
    id: Buffer.from(path.relative(root, absolutePath)).toString("base64url"),
    relativePath: path.relative(root, absolutePath),
    title,
    version: hash(raw),
    period,
    kind: inferred.kind,
    status: getString(values[fields.status]),
    date: inferReviewDate(getString(values[fields.date]), path.relative(root, absolutePath), title),
    periodStart: getString(values[fields.periodStart]),
    periodEnd: getString(values[fields.periodEnd]),
    projects: getStringArray(values[fields.projects]),
    metrics: reviewMetrics(values),
    isLegacy: inferred.legacy,
  };
}

function inferReviewDate(value: string, relativePath: string, title: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return `${relativePath} ${title}`.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
}

export async function readReviews(period?: ReviewPeriod, includeTests = false): Promise<ReviewRecord[]> {
  return (await readReviewsWithIssues(period, includeTests)).items;
}

export async function readReviewsWithIssues(period?: ReviewPeriod, includeTests = false): Promise<ReadResult<ReviewRecord>> {
  const root = await vaultRoot();
  const directories = vaultProfile().paths.reviews;
  const periods = period ? [period] : (Object.keys(directories) as ReviewPeriod[]);
  const result: ReviewRecord[] = [];
  const issues: VaultIssue[] = [];
  for (const item of periods) {
    const files = await markdownFiles(directories[item]);
    for (const file of files) {
      if (isVaultGuide(file)) continue;
      try {
        const raw = await fs.readFile(file, "utf8");
        const { yaml } = splitFrontmatter(raw);
        const values = yaml.toJS() as Record<string, unknown>;
        if (!includeTests && values[vaultProfile().properties.review.testArtifact] === true) continue;
        result.push(parseReview(raw, file, root, item));
        if (invalidReviewMetric(values)) issues.push({ kind: "review", relativePath: path.relative(root, file), code: "INVALID_REVIEW_METRIC", message: "冻结指标必须是非负整数；无效指标已按未采集处理。" });
      } catch (error) {
        issues.push(vaultIssue("review", file, root, error));
      }
    }
  }
  result.sort((a, b) => (b.date || b.periodEnd).localeCompare(a.date || a.periodEnd));
  return { items: result, issues };
}

export async function getReview(id: string): Promise<ReviewRecord> {
  const decoded = Buffer.from(id, "base64url").toString("utf8");
  const directories = Object.values(vaultProfile().paths.reviews);
  if (!directories.some((directory) => decoded.startsWith(`${directory}/`)) || !decoded.endsWith(".md")) {
    throw new AppError("报告标识无效。", 400, "INVALID_REVIEW_ID");
  }
  const root = await vaultRoot();
  const file = path.resolve(root, decoded);
  const real = await fs.realpath(file);
  if (!real.startsWith(`${root}${path.sep}`)) throw new AppError("报告路径超出 Vault 范围。", 403, "PATH_OUTSIDE_VAULT");
  const raw = await fs.readFile(real, "utf8");
  const period = (Object.entries(vaultProfile().paths.reviews) as Array<[ReviewPeriod, string]>).find(([, directory]) => decoded.startsWith(`${directory}/`))?.[0];
  if (!period) throw new AppError("报告路径超出已配置目录。", 403, "PATH_OUTSIDE_VAULT");
  return { ...parseReview(raw, real, root, period), body: splitFrontmatter(raw).body };
}

function projectRelativePath(id: string): string {
  const decoded = Buffer.from(id, "base64url").toString("utf8");
  const directory = vaultProfile().paths.projects;
  if (!id || Buffer.from(decoded).toString("base64url") !== id || !decoded.startsWith(`${directory}/`) || !decoded.endsWith(".md")) {
    throw new AppError("项目标识无效。", 400, "INVALID_PROJECT_ID");
  }
  return decoded;
}

async function projectLocation(id: string): Promise<string> {
  const decoded = projectRelativePath(id);
  const root = await vaultRoot();
  const file = path.resolve(root, decoded);
  const real = await fs.realpath(file).catch(() => "");
  if (!real) throw new AppError("找不到该项目页。", 404, "PROJECT_NOT_FOUND");
  if (!real.startsWith(`${root}${path.sep}`)) throw new AppError("项目页路径超出 Vault 范围。", 403, "PATH_OUTSIDE_VAULT");
  return real;
}

function projectWriteLocks(): Map<string, Promise<void>> {
  globalThis.__vibeProjectWriteLocks ??= new Map<string, Promise<void>>();
  return globalThis.__vibeProjectWriteLocks;
}

async function withProjectWriteLock<T>(id: string, operation: () => Promise<T>): Promise<T> {
  const locks = projectWriteLocks();
  const previous = locks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => gate);
  locks.set(id, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (locks.get(id) === tail) locks.delete(id);
  }
}

export async function transitionProject(id: string, input: ProjectTransitionInput): Promise<ProjectSummary> {
  projectRelativePath(id);
  return withProjectWriteLock(id, async () => {
    const file = await projectLocation(id);
    if (isVaultGuide(file)) throw new AppError("该文件不是可流转的项目页。", 404, "PROJECT_NOT_FOUND");
    const raw = await fs.readFile(file, "utf8");
    const document = splitFrontmatter(raw);
    const values = document.yaml.toJS() as Record<string, unknown>;
    const fields = vaultProfile().properties.project;
    const currentStatus = projectStatusFromSource(getString(values[fields.status]) || projectStatusToSource("active"));
    if (!input.expectedVersion || hash(raw) !== input.expectedVersion) {
      throw new AppError("项目页已被 Obsidian 或其他窗口修改。请刷新后再操作。", 409, "VERSION_CONFLICT");
    }
    const valid = input.transition === "archive"
      ? currentStatus === "active" || currentStatus === "review"
      : currentStatus === "archived";
    if (!valid) throw new AppError("当前项目状态不能执行此操作。", 422, "INVALID_PROJECT_TRANSITION");
    document.yaml.set(fields.status, projectStatusToSource(input.transition === "archive" ? "archived" : "active"));
    document.yaml.set(fields.updated, today());
    const next = stringifyFrontmatter(document);
    await backupAndWrite(file, raw, next);
    const updated = (await readProjects()).find((project) => project.id === id);
    if (!updated) throw new AppError("项目状态已写入，但无法重新读取项目页。", 500, "PROJECT_UPDATE_FAILED");
    return updated;
  });
}

export async function readProjects(): Promise<ProjectSummary[]> {
  return (await readProjectsWithIssues()).items;
}

export async function readProjectsWithIssues(providedActions?: ActionRecord[]): Promise<ReadResult<ProjectSummary>> {
  const actions = providedActions ?? (await readActionsWithIssues()).items;
  const todayValue = today();
  const root = await vaultRoot();
  const pages = new Map<string, { id: string; relativePath: string; version: string; updated: string; status: ProjectStatus }>();
  const issues: VaultIssue[] = [];
  const projectPath = vaultProfile().paths.projects;
  await requiredDirectory(projectPath, "PROJECTS_DIRECTORY_UNAVAILABLE", "无法访问 Vault 的项目目录。");
  const files = await markdownFiles(projectPath);
  for (const file of files) {
    if (isVaultGuide(file)) continue;
    try {
      const raw = await fs.readFile(file, "utf8");
      const values = splitFrontmatter(raw).yaml.toJS() as Record<string, unknown>;
      const status = projectStatusFromSource(getString(values[vaultProfile().properties.project.status]) || projectStatusToSource("active"));
      if (status === "unknown") issues.push({ kind: "project", relativePath: path.relative(root, file), code: "INVALID_PROJECT_STATUS", message: "项目状态无效，已按待确认项目显示。" });
      const relativePath = path.relative(root, file);
      pages.set(path.basename(file, ".md"), { id: Buffer.from(relativePath).toString("base64url"), relativePath, version: hash(raw), updated: getString(values[vaultProfile().properties.project.updated]), status });
    } catch (error) {
      issues.push(vaultIssue("project", file, root, error));
    }
  }
  const names = new Set(pages.keys());
  actions.flatMap((action) => action.projects.map(projectName)).forEach((name) => names.add(name));
  if (actions.some((action) => action.projects.length === 0)) names.add("未归类");
  const items = [...names].sort((a, b) => a.localeCompare(b, "zh-Hans-CN")).map((name) => {
    const grouped = actions.filter((action) => name === "未归类" ? action.projects.length === 0 : action.projects.some((item) => projectName(item) === name));
    const tasks = grouped.filter((action) => action.status === "active");
    const doneTasks = grouped.filter((action) => action.status === "archived" && action.actionState === "done");
    const cancelledTasks = grouped.filter((action) => action.status === "archived" && action.actionState === "cancelled");
    return {
      id: pages.get(name)?.id ?? "",
      name,
      wikiLink: name === "未归类" ? "" : toWikiProject(name),
      relativePath: pages.get(name)?.relativePath ?? "",
      version: pages.get(name)?.version ?? "",
      updated: pages.get(name)?.updated ?? "",
      status: name === "未归类" ? "active" : (pages.get(name)?.status ?? "unknown"),
      hasProjectPage: pages.has(name),
      activeCount: tasks.length,
      overdueCount: tasks.filter((task) => task.reviewOn && task.reviewOn < todayValue).length,
      waitingCount: tasks.filter((task) => task.actionState === "waiting").length,
      inProgressCount: tasks.filter((task) => task.actionState === "in_progress").length,
      overdueDeliveryCount: tasks.filter((task) => task.dueOn && task.dueOn < todayValue).length,
      tasks,
      doneTasks,
      cancelledTasks,
      doneCount: doneTasks.length,
      cancelledCount: cancelledTasks.length,
    };
  });
  return { items, issues };
}

export async function health(): Promise<HealthResponse> {
  const root = await vaultRoot();
  const actions = await readActionsWithIssues();
  const [reviews, projects] = await Promise.all([readReviewsWithIssues(), readProjectsWithIssues(actions.items)]);
  const issues = [...actions.issues, ...reviews.issues, ...projects.issues];
  return {
    ok: issues.length === 0,
    scannedAt: new Date().toISOString(),
    vaultName: path.basename(root),
    actionCount: actions.items.length,
    reviewCount: reviews.items.length,
    projectCount: projects.items.filter((project) => project.name !== "未归类").length,
    message: issues.length ? "部分 Vault 文件无法读取" : "Vault 联机正常",
    issues,
  };
}

export async function readWorkbenchSnapshot(): Promise<WorkbenchSnapshot> {
  const root = await vaultRoot();
  const actions = await readActionsWithIssues();
  const projects = await readProjectsWithIssues(actions.items);
  const issues = [...actions.issues, ...projects.issues];
  return { actions: actions.items, projects: projects.items, issues, vaultName: path.basename(root), scannedAt: new Date().toISOString(), actionCount: actions.items.length, projectCount: projects.items.filter((project) => project.name !== "未归类").length, capabilities: { writeEnabled: workbenchWriteEnabled() } };
}

export { projectName, today };
