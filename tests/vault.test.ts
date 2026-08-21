import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../lib/errors";
import { assertIsoDate, assertLocalRequest, assertSafeId } from "../lib/security";
import { createAction, createCollaborator, createProject, getAction, getCollaborator, getReview, patchAction, patchCollaborator, readActions, readActionsWithIssues, readCollaboratorsWithIssues, readProjects, readProjectsWithIssues, readReviews, readReviewsWithIssues, readWorkbenchSnapshot, transitionAction, transitionProject } from "../lib/vault";

let temporaryVault = "";
const fixture = path.join(process.cwd(), "tests", "fixtures", "vault");

beforeEach(async () => {
  temporaryVault = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-mission-control-"));
  await fs.cp(fixture, temporaryVault, { recursive: true });
  process.env.OBSIDIAN_VAULT_PATH = temporaryVault;
  process.env.WORKBENCH_WRITE_ENABLED = "false";
  delete process.env.WORKBENCH_TIME_ZONE;
  delete process.env.WORKBENCH_ACTIONS_DIR;
  delete process.env.WORKBENCH_PROJECTS_DIR;
  delete process.env.WORKBENCH_PROJECT_TEMPLATE;
  delete process.env.WORKBENCH_COLLABORATORS_DIR;
  delete process.env.WORKBENCH_COLLABORATOR_TEMPLATE;
  delete process.env.WORKBENCH_DAILY_DIR;
  delete process.env.WORKBENCH_WEEKLY_DIR;
  delete process.env.WORKBENCH_MONTHLY_DIR;
});

afterEach(async () => {
  await fs.rm(temporaryVault, { recursive: true, force: true });
  delete process.env.OBSIDIAN_VAULT_PATH;
});

describe("Vault adapter", () => {
  it("reads action and review fixtures", async () => {
    const [actions, reviews, projects] = await Promise.all([readActions(), readReviews("daily"), readProjects()]);
    expect(actions).toHaveLength(1);
    expect(actions[0].title).toBe("测试任务");
    expect(actions[0]).toMatchObject({ startOn: "2026-08-13", dueOn: "2026-08-15", scheduledFor: "2026-08-13" });
    expect(actions[0].projects).toEqual(["[[03_Topics/项目/测试项目]]"]);
    expect(reviews).toHaveLength(2);
    const report = reviews.find((review) => review.kind === "report");
    expect(report).toBeDefined();
    expect(reviews.find((review) => review.kind === "plan")?.date).toBe("2026-08-14");
    expect(projects.find((project) => project.name === "测试项目")?.activeCount).toBe(1);
    const full = await getReview(report!.id);
    expect(full.body).toContain("| 测试项目 | 正常 |");
  });

  it("degrades per malformed action, project, and review file while keeping valid content", async () => {
    await fs.writeFile(path.join(temporaryVault, "05_Review/Actions/ACT-broken.md"), "---\naction_id: invalid\n---\n# 破损事项\n");
    await fs.writeFile(path.join(temporaryVault, "03_Topics/项目/破损项目.md"), "---\nstatus: [\n---\n# 破损项目\n");
    await fs.writeFile(path.join(temporaryVault, "05_Review/Daily/破损日报.md"), "---\ndate: [\n---\n# 破损日报\n");
    const [actions, projects, reviews, snapshot] = await Promise.all([readActionsWithIssues(), readProjectsWithIssues(), readReviewsWithIssues("daily"), readWorkbenchSnapshot()]);
    expect(actions.items).toHaveLength(1);
    expect(actions.issues[0]).toMatchObject({ kind: "action", relativePath: "05_Review/Actions/ACT-broken.md" });
    expect(projects.items.find((item) => item.name === "测试项目")?.activeCount).toBe(1);
    expect(projects.issues[0]).toMatchObject({ kind: "project", relativePath: "03_Topics/项目/破损项目.md" });
    expect(reviews.items).toHaveLength(2);
    expect(reviews.issues[0]).toMatchObject({ kind: "review", relativePath: "05_Review/Daily/破损日报.md" });
    expect(snapshot.issues).toHaveLength(2);
    expect(snapshot.actions).toHaveLength(1);
    expect(snapshot.capabilities).toEqual({ writeEnabled: false });
  });

  it("ignores Starter guide notes while retaining malformed data warnings", async () => {
    await fs.writeFile(path.join(temporaryVault, "05_Review/Actions/00 使用说明.md"), "# 任务说明\n");
    await fs.writeFile(path.join(temporaryVault, "05_Review/Daily/README.md"), "# 日报说明\n");
    await fs.writeFile(path.join(temporaryVault, "03_Topics/项目/00 项目索引.md"), "# 项目索引\n");
    const [snapshot, reviews] = await Promise.all([readWorkbenchSnapshot(), readReviews("daily")]);
    expect(snapshot.actions).toHaveLength(1);
    expect(reviews).toHaveLength(2);
    expect(snapshot.projectCount).toBe(1);
    expect(snapshot.issues).toEqual([]);
  });

  it("keeps archived project history separate from active tasks", async () => {
    const page = path.join(temporaryVault, "03_Topics/项目/测试项目.md");
    await fs.writeFile(page, (await fs.readFile(page, "utf8")).replace("status: active", "status: archived"));
    const action = await getAction("ACT-20260813-001");
    const running = await transitionAction(action.id, { expectedVersion: action.version, transition: "start" });
    const done = await transitionAction(running.id, { expectedVersion: running.version, transition: "complete", note: "已完成" });
    const project = (await readProjects()).find((item) => item.name === "测试项目");
    expect(project).toMatchObject({ status: "archived", activeCount: 0, doneCount: 1, cancelledCount: 0 });
    expect(project?.doneTasks[0].id).toBe(done.id);
  });

  it("treats an unavailable project directory as a global infrastructure failure", async () => {
    await fs.rename(path.join(temporaryVault, "03_Topics/项目"), path.join(temporaryVault, "03_Topics/项目-不可用"));
    await expect(readWorkbenchSnapshot()).rejects.toMatchObject({ status: 503, code: "PROJECTS_DIRECTORY_UNAVAILABLE" });
  });

  it("rejects impossible calendar dates", () => {
    expect(() => assertIsoDate("2026-02-31", "计划日期")).toThrow(/有效的日历日期/);
    expect(() => assertIsoDate("2026-02-28", "计划日期")).not.toThrow();
  });

  it("preserves unknown properties and body while patching", async () => {
    const original = await getAction("ACT-20260813-001");
    const patched = await patchAction(original.id, { expectedVersion: original.version, nextAction: "更新后的下一动作", workstreams: ["验证", "复核"] });
    expect(patched.nextAction).toBe("更新后的下一动作");
    const raw = await fs.readFile(path.join(temporaryVault, original.relativePath), "utf8");
    expect(raw).toContain("custom_field: preserve-me");
    expect(raw).toContain("# 保留这个注释");
    expect(raw).toContain("| 2026-08-13 | ready | 测试夹具。 |");
  });

  it("rejects conflicts and does not overwrite the newer file", async () => {
    const action = await getAction("ACT-20260813-001");
    const file = path.join(temporaryVault, action.relativePath);
    await fs.appendFile(file, "\n外部修改\n");
    await expect(patchAction(action.id, { expectedVersion: action.version, nextAction: "不应该写入" })).rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT" });
    expect(await fs.readFile(file, "utf8")).toContain("外部修改");
  });

  it("serializes concurrent writes and releases the task lock after failures", async () => {
    const action = await getAction("ACT-20260813-001");
    const writes = await Promise.allSettled([
      patchAction(action.id, { expectedVersion: action.version, nextAction: "第一个写入" }),
      transitionAction(action.id, { expectedVersion: action.version, transition: "start" }),
    ]);
    expect(writes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(writes.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rejected = writes.find((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(rejected?.reason).toMatchObject({ status: 409, code: "VERSION_CONFLICT" });

    const current = await getAction(action.id);
    await expect(patchAction(current.id, { expectedVersion: current.version, nextAction: "" })).rejects.toMatchObject({ code: "FIELD_REQUIRED" });
    const unlocked = await getAction(action.id);
    const saved = await patchAction(unlocked.id, { expectedVersion: unlocked.version, nextAction: "锁已释放" });
    expect(saved.nextAction).toBe("锁已释放");
  });

  it("creates and transitions a task with lifecycle guards", async () => {
    const created = await createAction({ title: "新建测试任务", actionArea: "project", project: "测试项目", workstreams: ["MVP"], nextAction: "开始验证", completionStandard: "形成结果", startOn: "2026-08-14", dueOn: "2026-08-18", scheduledFor: "2026-08-14" });
    expect(created.id).toMatch(/^ACT-\d{8}-\d{3}$/);
    expect(created.actionState).toBe("ready");
    expect(created).toMatchObject({ startOn: "2026-08-14", dueOn: "2026-08-18" });
    await expect(transitionAction(created.id, { expectedVersion: created.version, transition: "wait", reviewOn: "2026-08-15", note: "不允许" })).rejects.toMatchObject({ code: "INVALID_STATE_TRANSITION" });
    await expect(transitionAction(created.id, { expectedVersion: created.version, transition: "complete", note: "不允许" })).rejects.toMatchObject({ code: "INVALID_STATE_TRANSITION" });
    const running = await transitionAction(created.id, { expectedVersion: created.version, transition: "start" });
    expect(running.actionState).toBe("in_progress");
    const carriedToSchedule = await transitionAction(running.id, { expectedVersion: running.version, transition: "carryover", scheduledFor: "2026-08-16" });
    expect(carriedToSchedule.actionState).toBe("ready");
    expect(carriedToSchedule.scheduledFor).toBe("2026-08-16");
    expect(carriedToSchedule).toMatchObject({ startOn: "2026-08-14", dueOn: "2026-08-18" });
    expect(carriedToSchedule.carryoverCount).toBe(1);
    const carriedToBacklog = await transitionAction(carriedToSchedule.id, { expectedVersion: carriedToSchedule.version, transition: "carryover" });
    expect(carriedToBacklog.actionState).toBe("backlog");
    expect(carriedToBacklog.scheduledFor).toBe("");
    expect(carriedToBacklog.carryoverCount).toBe(2);
    await expect(transitionAction(carriedToBacklog.id, { expectedVersion: carriedToBacklog.version, transition: "wait" })).rejects.toMatchObject({ code: "INVALID_STATE_TRANSITION" });
    const restarted = await transitionAction(carriedToBacklog.id, { expectedVersion: carriedToBacklog.version, transition: "start" });
    await expect(transitionAction(restarted.id, { expectedVersion: restarted.version, transition: "wait" })).rejects.toMatchObject({ code: "WAITING_REVIEW_REQUIRED" });
    const waiting = await transitionAction(restarted.id, { expectedVersion: restarted.version, transition: "wait", reviewOn: "2026-08-15", note: "等待用户确认" });
    expect(waiting.actionState).toBe("waiting");
    await expect(transitionAction(waiting.id, { expectedVersion: waiting.version, transition: "complete", note: "不允许" })).rejects.toMatchObject({ code: "INVALID_STATE_TRANSITION" });
    const resumed = await transitionAction(waiting.id, { expectedVersion: waiting.version, transition: "start" });
    const complete = await transitionAction(resumed.id, { expectedVersion: resumed.version, transition: "complete", note: "已确认并完成" });
    expect(complete.status).toBe("archived");
    expect(complete.actionState).toBe("done");
    await expect(patchAction(complete.id, { expectedVersion: complete.version, nextAction: "不允许修改" })).rejects.toMatchObject({ code: "ARCHIVED_ACTION_READ_ONLY" });
    const raw = await fs.readFile(path.join(temporaryVault, complete.relativePath), "utf8");
    expect(raw).toContain("已确认并完成");
  });

  it("serializes concurrent action creation without overwriting a filename", async () => {
    const base = { title: "并发新建事项", actionArea: "personal" as const, nextAction: "验证编号", completionStandard: "两个文件都存在" };
    const created = await Promise.all([createAction(base), createAction(base)]);
    expect(new Set(created.map((item) => item.id)).size).toBe(2);
    const files = await fs.readdir(path.join(temporaryVault, "05_Review/Actions"));
    expect(files.filter((file) => file.includes("并发新建事项"))).toHaveLength(2);
  });

  it("keeps legacy dates empty and validates delivery-window edits", async () => {
    const legacyPath = path.join(temporaryVault, "05_Review/Actions/ACT-20260813-002 历史任务.md");
    const fixtureRaw = await fs.readFile(path.join(temporaryVault, "05_Review/Actions/ACT-20260813-001 测试任务.md"), "utf8");
    await fs.writeFile(legacyPath, fixtureRaw.replace("ACT-20260813-001", "ACT-20260813-002").replace("# 测试任务", "# 历史任务").replace("start_on: 2026-08-13\ndue_on: 2026-08-15\n", ""));
    expect(await getAction("ACT-20260813-002")).toMatchObject({ startOn: "", dueOn: "" });

    const current = await getAction("ACT-20260813-001");
    await expect(patchAction(current.id, { expectedVersion: current.version, startOn: "2026-08-20", dueOn: "2026-08-18" })).rejects.toMatchObject({ status: 422, code: "INVALID_INPUT" });
    const latest = await getAction(current.id);
    const patched = await patchAction(latest.id, { expectedVersion: latest.version, startOn: "2026-08-14", dueOn: "2026-08-18" });
    expect(patched).toMatchObject({ startOn: "2026-08-14", dueOn: "2026-08-18" });
    const cleared = await patchAction(patched.id, { expectedVersion: patched.version, startOn: "", dueOn: "" });
    expect(cleared).toMatchObject({ startOn: "", dueOn: "" });
    const after = await getAction(cleared.id);
    await expect(patchAction(after.id, { expectedVersion: after.version, startOn: "2026-02-31" })).rejects.toMatchObject({ status: 422, code: "INVALID_INPUT" });
  });

  it("creates a complete project page and exposes zero-task projects", async () => {
    const project = await createProject({ name: "新项目", goal: "完成项目初始化", successCriteria: "形成可执行首页", nextAction: "建立第一张任务卡", targetDate: "2026-08-20" });
    expect(project.activeCount).toBe(0);
    expect(project.hasProjectPage).toBe(true);
    expect(project.relativePath).toBe("03_Topics/项目/新项目.md");
    const raw = await fs.readFile(path.join(temporaryVault, project.relativePath), "utf8");
    expect(raw).toContain("# 新项目");
    expect(raw).toContain("- 目标：完成项目初始化");
    expect(raw).toContain("- 成功标准：形成可执行首页");
    expect(raw).toContain("- [ ] 建立第一张任务卡");
    expect(raw).toContain('target_date: "2026-08-20"');
    expect((await readProjects()).find((item) => item.name === "新项目")?.activeCount).toBe(0);
    await expect(createProject({ name: "新项目", goal: "重复", successCriteria: "重复", nextAction: "重复" })).rejects.toMatchObject({ code: "PROJECT_EXISTS" });
    await expect(createProject({ name: "../越界", goal: "非法", successCriteria: "非法", nextAction: "非法" })).rejects.toMatchObject({ code: "INVALID_PROJECT_NAME" });
  });

  it("archives and restores a project without changing active tasks", async () => {
    const before = (await readProjects()).find((project) => project.name === "测试项目")!;
    const action = await getAction("ACT-20260813-001");
    const archived = await transitionProject(before.id, { expectedVersion: before.version, transition: "archive" });
    expect(archived).toMatchObject({ status: "archived", activeCount: 1, id: before.id });
    expect((await getAction(action.id)).status).toBe("active");
    const raw = await fs.readFile(path.join(temporaryVault, archived.relativePath), "utf8");
    expect(raw).toContain("status: archived");
    expect(raw).toContain("# 测试项目");
    await expect(transitionProject(archived.id, { expectedVersion: archived.version, transition: "restore" })).resolves.toMatchObject({ status: "active" });
  });

  it("rejects invalid project transitions and serializes concurrent writes", async () => {
    const project = (await readProjects()).find((item) => item.name === "测试项目")!;
    await expect(transitionProject("not-a-project", { expectedVersion: project.version, transition: "archive" })).rejects.toMatchObject({ code: "INVALID_PROJECT_ID" });
    const results = await Promise.allSettled([
      transitionProject(project.id, { expectedVersion: project.version, transition: "archive" }),
      transitionProject(project.id, { expectedVersion: project.version, transition: "archive" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const archived = (await readProjects()).find((item) => item.name === "测试项目")!;
    await expect(transitionProject(archived.id, { expectedVersion: archived.version, transition: "archive" })).rejects.toMatchObject({ code: "INVALID_PROJECT_TRANSITION" });
    await expect(transitionProject(archived.id, { expectedVersion: archived.version, transition: "restore" })).resolves.toMatchObject({ status: "active" });
  });

  it("reads, creates, and safely edits collaborator role cards", async () => {
    const initial = await readCollaboratorsWithIssues();
    expect(initial).toMatchObject({ available: true });
    expect(initial.items[0]).toMatchObject({ title: "测试协作人", relationshipRoles: ["项目顾问"] });
    const existing = initial.items[0];
    const patched = await patchCollaborator(existing.id, { expectedVersion: existing.version, aliases: ["新别名"], relationshipRoles: ["策略顾问"], collaborationTopics: ["增长策略"] });
    expect(patched.aliases).toEqual(["新别名"]);
    expect(await fs.readFile(path.join(temporaryVault, existing.relativePath), "utf8")).toContain("这段正文必须被编辑保留。");
    await expect(patchCollaborator(existing.id, { expectedVersion: existing.version, aliases: ["冲突"] })).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    const created = await createCollaborator({ name: "新协作人", relationshipRoles: ["合作伙伴"], projects: ["测试项目"] });
    expect(created).toMatchObject({ title: "新协作人", status: "active", assetScope: "personal", sensitivity: "restricted" });
    await expect(createCollaborator({ name: "新协作人", relationshipRoles: ["合作伙伴"], projects: ["测试项目"] })).rejects.toMatchObject({ code: "COLLABORATOR_EXISTS" });
    await expect(createCollaborator({ name: "../越界", relationshipRoles: ["合作伙伴"], projects: ["测试项目"] })).rejects.toMatchObject({ code: "INVALID_COLLABORATOR_NAME" });
    await expect(createCollaborator({ name: "缺少上下文", relationshipRoles: ["合作伙伴"] })).rejects.toMatchObject({ code: "COLLABORATOR_CONTEXT_REQUIRED" });
    const raw = await getCollaborator(created.id);
    await expect(patchCollaborator(raw.id, { expectedVersion: raw.version, projects: [], collaborationTopics: [] })).rejects.toMatchObject({ code: "COLLABORATOR_CONTEXT_REQUIRED" });
  });

  it("degrades invalid frozen metrics without hiding the report", async () => {
    const report = path.join(temporaryVault, "05_Review/Daily/2026-08/Report/2026-08-13.md");
    const raw = await fs.readFile(report, "utf8");
    await fs.writeFile(report, raw.replace("status: complete", "status: complete\nmetric_completed_actions: -1"));
    const reviews = await readReviewsWithIssues("daily");
    expect(reviews.items).toHaveLength(2);
    expect(reviews.issues).toContainEqual(expect.objectContaining({ code: "INVALID_REVIEW_METRIC" }));
    expect(reviews.items.find((item) => item.kind === "report")?.metrics).toBeNull();
  });

  it("rejects project creation when the template is unavailable", async () => {
    await fs.rename(path.join(temporaryVault, "98_Templates", "项目主页.md"), path.join(temporaryVault, "98_Templates", "项目主页.bak"));
    await expect(createProject({ name: "无法创建", goal: "测试", successCriteria: "测试", nextAction: "测试" })).rejects.toMatchObject({ code: "PROJECT_TEMPLATE_MISSING" });
  });

  it("rejects project creation when the template structure is invalid", async () => {
    await fs.writeFile(path.join(temporaryVault, "98_Templates", "项目主页.md"), "# {{title}}\n");
    await expect(createProject({ name: "无法创建", goal: "测试", successCriteria: "测试", nextAction: "测试" })).rejects.toMatchObject({ code: "PROJECT_TEMPLATE_INVALID" });
  });

  it("does not allow invalid task identifiers", () => {
    expect(() => assertSafeId("../../secret")).toThrow(AppError);
    expect(() => assertLocalRequest(new Request("http://mission.local/api/actions", { headers: { host: "mission.local" } }))).toThrow(AppError);
    expect(() => assertLocalRequest(new Request("http://127.0.0.1/api/actions", { method: "POST", headers: { host: "127.0.0.1", origin: "http://evil.test", "content-type": "application/json" } }), true)).toThrow(AppError);
  });

  it("uses content hashes as versions", async () => {
    const action = await getAction("ACT-20260813-001");
    const raw = await fs.readFile(path.join(temporaryVault, action.relativePath), "utf8");
    expect(action.version).toBe(createHash("sha256").update(raw).digest("hex"));
  });
});
