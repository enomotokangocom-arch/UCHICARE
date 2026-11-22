import { GeneratedMinutes, MinutesGenerationInput } from "./minutesTypes";

export async function generateMinutes(input: MinutesGenerationInput): Promise<GeneratedMinutes> {
  const res = await fetch("/api/minutes/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    // Vercelのタイムアウト等でJSON以外が返る場合
    throw new Error(res.status === 504 ? "AIの処理が時間内に終わりませんでした。文字起こしを短く分けてお試しください。" : `議事録の作成に失敗しました(${res.status})。`);
  }
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `議事録の作成に失敗しました(${res.status})。`);
  }
  return body as GeneratedMinutes;
}
