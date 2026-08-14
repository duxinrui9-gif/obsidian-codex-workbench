import { errorResponse } from "@/lib/errors";
import { parseCreateProject } from "@/lib/inputs";
import { assertLocalRequest, assertWriteEnabled } from "@/lib/security";
import { createProject, readProjects } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    assertLocalRequest(request);
    return Response.json(await readProjects(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertLocalRequest(request, true);
    assertWriteEnabled();
    return Response.json(await createProject(await parseCreateProject(request)), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
