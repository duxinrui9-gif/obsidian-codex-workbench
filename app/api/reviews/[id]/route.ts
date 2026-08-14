import { errorResponse } from "@/lib/errors";
import { assertLocalRequest } from "@/lib/security";
import { getReview } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    assertLocalRequest(request);
    return Response.json(await getReview((await params).id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
