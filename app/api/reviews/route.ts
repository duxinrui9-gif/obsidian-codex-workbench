import { errorResponse } from "@/lib/errors";
import { assertLocalRequest } from "@/lib/security";
import { readReviewsWithIssues } from "@/lib/vault";
import type { ReviewPeriod } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    assertLocalRequest(request);
    const period = new URL(request.url).searchParams.get("period");
    const valid = period === "daily" || period === "weekly" || period === "monthly" ? (period as ReviewPeriod) : undefined;
    const result = await readReviewsWithIssues(valid);
    return Response.json({ reviews: result.items, issues: result.issues }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
