import { AppError } from "@/lib/errors";
import { workbenchWriteEnabled } from "@/lib/vault-profile";

export function assertLocalRequest(request: Request, write = false): void {
  const host = request.headers.get("host") ?? "";
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) {
    throw new AppError("此服务只接受本机请求。", 403, "LOCALHOST_ONLY");
  }
  if (write) {
    const origin = request.headers.get("origin");
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
      throw new AppError("写入请求必须来自本机工作台。", 403, "SAME_ORIGIN_REQUIRED");
    }
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new AppError("写入请求必须使用 JSON。", 415, "JSON_REQUIRED");
    }
  }
}

export function assertWriteEnabled(): void {
  if (!workbenchWriteEnabled()) throw new AppError("当前工作台处于只读接入模式。完成 Vault 验证后可将 WORKBENCH_WRITE_ENABLED 设为 true。", 403, "WRITE_DISABLED");
}

export function assertSafeId(id: string): void {
  if (!/^ACT-\d{8}-\d{3}$/.test(id)) {
    throw new AppError("任务 ID 格式无效。", 400, "INVALID_ACTION_ID");
  }
}

export function assertIsoDate(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(`${field}需要使用 YYYY-MM-DD 格式。`, 422, "INVALID_DATE");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new AppError(`${field}不是有效的日历日期。`, 422, "INVALID_DATE");
  }
}
