import { errorResponse } from "@/lib/errors";
import { parseCollaboratorPatch } from "@/lib/inputs";
import { assertLocalRequest, assertWriteEnabled } from "@/lib/security";
import { getCollaborator, patchCollaborator } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    assertLocalRequest(request);
    return Response.json(await getCollaborator((await params).id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    assertLocalRequest(request, true);
    assertWriteEnabled();
    return Response.json(await patchCollaborator((await params).id, await parseCollaboratorPatch(request)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
