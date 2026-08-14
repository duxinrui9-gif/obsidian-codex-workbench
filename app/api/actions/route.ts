import { errorResponse } from "@/lib/errors";
import { parseCreateAction } from "@/lib/inputs";
import { assertLocalRequest, assertWriteEnabled } from "@/lib/security";
import { createAction, readActions } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    assertLocalRequest(request);
    return Response.json(await readActions(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertLocalRequest(request, true);
    assertWriteEnabled();
    const input = await parseCreateAction(request);
    return Response.json(await createAction(input), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
