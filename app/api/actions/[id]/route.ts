import { errorResponse } from "@/lib/errors";
import { parseActionPatch } from "@/lib/inputs";
import { assertLocalRequest, assertWriteEnabled } from "@/lib/security";
import { getAction, patchAction } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    assertLocalRequest(request);
    return Response.json(await getAction((await params).id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    assertLocalRequest(request, true);
    assertWriteEnabled();
    const payload = await parseActionPatch(request);
    return Response.json(await patchAction((await params).id, payload), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
