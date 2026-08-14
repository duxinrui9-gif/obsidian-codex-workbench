import type { ActionRecord, TransitionInput } from "@/lib/types";

export type TransitionChoice = TransitionInput["transition"];
export type TransitionField = "note" | "reviewOn" | "scheduledFor";

export type TransitionBuildResult =
  | { ok: true; payload: TransitionInput }
  | { ok: false; field: TransitionField; error: string };

export function buildTransitionInput(action: ActionRecord, transition: TransitionChoice, note: string): TransitionBuildResult {
  const cleanedNote = note.trim();
  const payload: TransitionInput = { expectedVersion: action.version, transition };

  if (transition === "wait") {
    if (!cleanedNote) return { ok: false, field: "note", error: "请填写等待说明，方便下次复查时判断。" };
    if (!action.reviewOn) return { ok: false, field: "reviewOn", error: "请填写复查日期。" };
    return { ok: true, payload: { ...payload, note: cleanedNote, reviewOn: action.reviewOn } };
  }
  if (transition === "complete") {
    if (!cleanedNote) return { ok: false, field: "note", error: "请填写完成结果。" };
    return { ok: true, payload: { ...payload, note: cleanedNote } };
  }
  if (transition === "cancel") {
    if (!cleanedNote) return { ok: false, field: "note", error: "请填写取消原因。" };
    return { ok: true, payload: { ...payload, note: cleanedNote } };
  }
  if (transition === "schedule") {
    if (!action.scheduledFor) return { ok: false, field: "scheduledFor", error: "请填写计划日期。" };
    return { ok: true, payload: { ...payload, note: cleanedNote || undefined, scheduledFor: action.scheduledFor } };
  }
  if (transition === "carryover") {
    return { ok: true, payload: { ...payload, note: cleanedNote || undefined, scheduledFor: action.scheduledFor || undefined } };
  }
  return { ok: true, payload };
}
