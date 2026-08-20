import { describe, expect, it } from "vitest";
import { parseActionPatch, parseCollaboratorPatch, parseCreateAction, parseCreateCollaborator, parseCreateProject, parseTransition } from "../lib/inputs";

function request(body: string): Request { return new Request("http://localhost/api/test", { method: "POST", headers: { "content-type": "application/json" }, body }); }

describe("runtime request parsing", () => {
  it("returns a structured invalid JSON error", async () => {
    await expect(parseCreateAction(request("{"))).rejects.toMatchObject({ status: 400, code: "INVALID_JSON" });
  });

  it("rejects missing fields, wrong arrays, and invalid enums", async () => {
    await expect(parseCreateProject(request('{"name":"项目"}'))).rejects.toMatchObject({ status: 422, code: "INVALID_INPUT" });
    await expect(parseCreateAction(request('{"title":"事项","actionArea":"invalid","nextAction":"下一步","completionStandard":"标准"}'))).rejects.toMatchObject({ status: 422, code: "INVALID_INPUT" });
    await expect(parseActionPatch(request('{"expectedVersion":"v","projects":"not-array"}'))).rejects.toMatchObject({ status: 422, code: "INVALID_INPUT" });
    await expect(parseTransition(request('{"expectedVersion":"v","transition":"skip"}'))).rejects.toMatchObject({ status: 422, code: "INVALID_INPUT" });
    await expect(parseCreateCollaborator(request('{"name":"协作人","relationshipRoles":"not-array"}'))).rejects.toMatchObject({ status: 422, code: "INVALID_INPUT" });
    await expect(parseCollaboratorPatch(request('{"expectedVersion":"v","projects":"not-array"}'))).rejects.toMatchObject({ status: 422, code: "INVALID_INPUT" });
  });

  it("parses collaborator stable fields without allowing title or status changes", async () => {
    await expect(parseCreateCollaborator(request('{"name":"协作人","relationshipRoles":["顾问"],"projects":["测试项目"]}'))).resolves.toMatchObject({ name: "协作人", relationshipRoles: ["顾问"] });
    await expect(parseCollaboratorPatch(request('{"expectedVersion":"v","status":"archived","aliases":["别名"]}'))).resolves.toEqual({ expectedVersion: "v", aliases: ["别名"] });
  });

  it("keeps a valid write payload compatible with the existing API", async () => {
    await expect(parseCreateAction(request('{"title":"事项","actionArea":"project","nextAction":"推进","completionStandard":"完成","workstreams":["MVP"],"startOn":"2026-08-14","dueOn":"2026-08-16","scheduledFor":"2026-08-14"}'))).resolves.toMatchObject({ actionArea: "project", startOn: "2026-08-14", dueOn: "2026-08-16", scheduledFor: "2026-08-14" });
  });
});
