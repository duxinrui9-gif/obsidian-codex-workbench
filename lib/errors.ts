export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly code: string = "BAD_REQUEST",
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error(error);
  return Response.json(
    { error: "任务控制服务发生错误。请刷新后重试。", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}
