import { ConsultationAssistInput, IntakeResult, ResponderResult } from "./consultationTypes";

async function call<T>(input: ConsultationAssistInput): Promise<T> {
  const res = await fetch("/api/consultation/assist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(res.status === 504 ? "AIの処理が時間内に終わりませんでした。もう一度お試しください。" : `AIによる整理に失敗しました(${res.status})。`);
  }
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `AIによる整理に失敗しました(${res.status})。`);
  return body as T;
}

export const organizeConsultation = (deskName: string, text: string, wishes: string) =>
  call<IntakeResult>({ mode: "intake", deskName, text, wishes });

export const assistResponder = (deskName: string, text: string) => call<ResponderResult>({ mode: "responder", deskName, text });
