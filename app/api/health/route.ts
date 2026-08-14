import { errorResponse } from "@/lib/errors";
import { assertLocalRequest } from "@/lib/security";
import { health } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    assertLocalRequest(request);
    return Response.json(await health(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
