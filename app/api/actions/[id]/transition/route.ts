import { errorResponse } from "@/lib/errors";
import { parseTransition } from "@/lib/inputs";
import { assertLocalRequest, assertWriteEnabled } from "@/lib/security";
import { transitionAction } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    assertLocalRequest(request, true);
    assertWriteEnabled();
    const payload = await parseTransition(request);
    return Response.json(await transitionAction((await params).id, payload), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
