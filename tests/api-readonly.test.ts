import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as createAction } from "../app/api/actions/route";
import { PATCH as patchAction } from "../app/api/actions/[id]/route";
import { POST as transitionAction } from "../app/api/actions/[id]/transition/route";
import { POST as createProject } from "../app/api/projects/route";
import { POST as transitionProject } from "../app/api/projects/[id]/transition/route";
import { POST as createCollaborator } from "../app/api/collaborators/route";
import { PATCH as patchCollaborator } from "../app/api/collaborators/[id]/route";

const previous = process.env.WORKBENCH_WRITE_ENABLED;
const context = { params: Promise.resolve({ id: "ACT-20260814-001" }) };
function request() { return new Request("http://127.0.0.1/api/actions", { method: "POST", headers: { host: "127.0.0.1", origin: "http://127.0.0.1", "content-type": "application/json" }, body: "{}" }); }

beforeEach(() => { process.env.WORKBENCH_WRITE_ENABLED = "false"; });
afterEach(() => { if (previous === undefined) delete process.env.WORKBENCH_WRITE_ENABLED; else process.env.WORKBENCH_WRITE_ENABLED = previous; });

describe("read-only write guard", () => {
  it("rejects every write route before parsing or touching the Vault", async () => {
    const responses = await Promise.all([createAction(request()), patchAction(request(), context), transitionAction(request(), context), createProject(request()), transitionProject(request(), context), createCollaborator(request()), patchCollaborator(request(), context)]);
    for (const response of responses) {
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ code: "WRITE_DISABLED" });
    }
  });
});
