import { errorResponse } from "@/lib/errors";
import { parseCreateCollaborator } from "@/lib/inputs";
import { assertLocalRequest, assertWriteEnabled } from "@/lib/security";
import { createCollaborator, readCollaboratorsWithIssues } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    assertLocalRequest(request);
    const result = await readCollaboratorsWithIssues();
    return Response.json({ collaborators: result.items, issues: result.issues, available: result.available }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertLocalRequest(request, true);
    assertWriteEnabled();
    return Response.json(await createCollaborator(await parseCreateCollaborator(request)), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
