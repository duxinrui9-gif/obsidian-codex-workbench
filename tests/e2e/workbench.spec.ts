import { expect, test } from "@playwright/test";

async function open(page: import("@playwright/test").Page, label: string) {
  await page.goto("/");
  await page.getByRole("button", { name: label, exact: true }).click();
}

test("风险筛选携带复查日期并可清除", async ({ page }) => {
  await page.goto("/");
  await page.locator(".risk-matrix button").filter({ hasText: "逾期复查" }).click();
  await expect(page.getByRole("status")).toContainText("筛选：逾期复查 · 1 项");
  await expect(page.locator("#task-panel-status").getByText("演示逾期复查")).toBeVisible();
  await expect(page.locator("#task-panel-status").getByText("复 2000-01-01")).toBeVisible();
  await page.getByRole("button", { name: "清除筛选" }).click();
  await expect(page.getByRole("status")).toContainText("当前：1 项");
});

test("标签支持方向键、Home 和 End", async ({ page }) => {
  await open(page, "项目看板");
  const active = page.getByRole("tab", { name: "进行中" });
  await active.focus(); await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "已结束" })).toBeFocused();
  await open(page, "协作人");
  const collaborator = page.getByRole("tab", { name: /使用中/ });
  await collaborator.focus(); await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: /待确认/ })).toBeFocused();
  await open(page, "日报");
  const report = page.getByRole("tab", { name: "报告" });
  await expect(page.getByRole("tab", { name: "规划" })).toBeEnabled();
  await report.focus(); await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "规划" })).toBeFocused();
});

test("快速切换日报类型时正文始终保持当前选择，日期名称完整", async ({ page }) => {
  let delayed = false;
  await page.route("**/api/reviews/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (!delayed && /^\/api\/reviews\/[^/]+$/.test(pathname)) { delayed = true; const response = await route.fetch(); await new Promise((resolve) => setTimeout(resolve, 350)); await route.fulfill({ response }); return; }
    await route.continue();
  });
  await open(page, "日报");
  await expect(page.getByRole("button", { name: "2026-08-20，报告和规划" })).toBeVisible();
  await page.getByRole("tab", { name: "规划" }).click();
  await expect(page.getByRole("heading", { name: "演示规划" })).toBeVisible();
  await expect(page.getByText("规划正文内容。")).toBeVisible();
});

test("协作人抽屉恢复焦点并使用 vault 加 file URI", async ({ page }) => {
  await open(page, "协作人");
  const card = page.getByRole("button", { name: /演示协作人/ });
  await card.click();
  const link = page.getByRole("link", { name: "在 Obsidian 打开" });
  await expect(link).toHaveAttribute("href", /obsidian:\/\/open\?vault=.*&file=03_Topics/);
  await page.keyboard.press("Escape");
  await expect(card).toBeFocused();
});

test("离线页面无外部资源且 1280px 没有页面级溢出", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (request) => { const url = new URL(request.url()); if (url.protocol.startsWith("http") && url.hostname !== "127.0.0.1") external.push(request.url()); });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const textSizes = await page.locator("body *").evaluateAll((nodes) => nodes.filter((node) => !node.children.length && node.textContent?.trim()).map((node) => ({ tag: node.tagName, className: node.className, text: node.textContent?.trim(), size: Number.parseFloat(getComputedStyle(node).fontSize) })));
  expect(Math.min(...textSizes.map((item) => item.size)), JSON.stringify(textSizes.filter((item) => item.size < 11))).toBeGreaterThanOrEqual(11);
  expect(external).toEqual([]);
});

test("各板块在桌面宽度没有小于 11px 的可见文字", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const label of ["任务看板", "项目看板", "协作人", "日报"]) {
    await open(page, label);
    if (label === "日报") await expect(page.locator(".review-console")).toBeVisible();
    const sizes = await page.locator("body *").evaluateAll((nodes) => nodes.filter((node) => !node.children.length && node.textContent?.trim()).map((node) => ({ text: node.textContent?.trim(), className: node.className, size: Number.parseFloat(getComputedStyle(node).fontSize) })));
    expect(Math.min(...sizes.map((item) => item.size)), `${label}: ${JSON.stringify(sizes.filter((item) => item.size < 11))}`).toBeGreaterThanOrEqual(11);
  }
});

test("三种桌面宽度在明暗主题都没有页面级溢出", async ({ page }) => {
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.getByRole("button", { name: "切换明暗主题" }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

test("任务筛选可组合，日历日期格不会裁切信号", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, "任务看板");
  await page.getByLabel("关键词").fill("演示");
  const filters = page.locator(".task-filters");
  await filters.getByLabel("项目").selectOption("演示项目");
  await filters.getByLabel("状态").selectOption("waiting");
  await filters.getByLabel("日期风险").selectOption("overdue_review");
  await expect(page.getByRole("status")).toContainText("关键词“演示” · 演示项目 · 等待 · 逾期复查 · 1 项");
  await page.getByRole("tab", { name: "日历看板" }).click();
  await expect(page.locator(".task-calendar-day").evaluateAll((nodes) => nodes.every((node) => node.scrollHeight <= node.clientHeight && node.scrollWidth <= node.clientWidth))).resolves.toBe(true);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("项目结束确认保留活跃任务并支持恢复", async ({ page }) => {
  let archived = false;
  let project: Record<string, unknown> | null = null;
  await page.route("**/api/workbench", async (route) => {
    const response = await route.fetch();
    const body = await response.json() as { projects: Array<Record<string, unknown>>; capabilities: { writeEnabled: boolean } };
    const current = body.projects.find((item) => item.name === "演示项目");
    if (current) {
      project = { ...current, status: archived ? "archived" : "active", version: archived ? "archived-version" : "active-version" };
      body.projects = body.projects.map((item) => item.name === "演示项目" ? project! : item);
    }
    body.capabilities = { writeEnabled: true };
    await route.fulfill({ response, json: body });
  });
  await page.route("**/api/projects/*/transition", async (route) => {
    const input = route.request().postDataJSON() as { transition: "archive" | "restore" };
    archived = input.transition === "archive";
    project = { ...project!, status: archived ? "archived" : "active", version: archived ? "archived-version" : "active-version" };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(project) });
  });
  await open(page, "项目看板");
  const end = page.getByRole("button", { name: "结束项目" });
  await end.click();
  await expect(page.getByRole("dialog")).toContainText("仍有 1 个活跃任务");
  await page.getByRole("button", { name: "确认结束项目" }).click();
  await expect(page.locator(".project-transition-success")).toContainText("已结束项目：演示项目");
  await page.getByRole("tab", { name: "已结束" }).click();
  await expect(page.getByRole("heading", { name: "演示项目" })).toBeVisible();
  await page.getByRole("button", { name: "恢复项目" }).click();
  await page.getByRole("button", { name: "确认恢复项目" }).click();
  await expect(page.locator(".project-transition-success")).toContainText("已恢复项目：演示项目");
});
