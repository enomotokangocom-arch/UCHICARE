import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { GeneratedMinutes, MAX_TRANSCRIPT_CHARS, MinutesGenerationInput } from "@/lib/minutesTypes";

export const runtime = "nodejs";
// 文字起こしが長いと生成に数十秒かかるため上限を延長する(Hobbyプランの上限は60秒)。
export const maxDuration = 60;

const SYSTEM_PROMPT = `あなたは訪問看護ステーション・居宅介護支援事業所を運営する株式会社Uchi careの、委員会の議事録作成担当です。
会議の録音の文字起こしから、実地指導・監査でそのまま提出できる、簡潔で正確な議事録を作成します。

作成ルール:
- 文字起こしにない事実・数字・決定事項を作らないこと。聞き取れない・曖昧な箇所は「[要確認]」と書く。
- 音声認識の誤変換は、介護・医療の文脈から明らかな場合だけ正しい語に直す(例: 「ほうかん」→「訪看」)。
- 利用者・家族の氏名が出てきた場合は「A様」「B様」のように置き換え、個人を特定できる情報を書かない。
- 雑談・相づち・言い直しは省く。
- 文体は「である」調。各項目は「・」で始まる箇条書きを基本にする。
- summary: 会議全体の要約を3〜5行で。
- agenda: 議題を「1. 」「2. 」と番号付きで。
- discussion: 議題ごとの主な意見・報告・検討内容。
- decisions: 決定事項と今後の対応(担当者・期限が話されていれば併記)。
- nextDate: 次回開催日が具体的に話されていれば YYYY-MM-DD 形式。なければ空文字。`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    agenda: { type: "string" },
    discussion: { type: "string" },
    decisions: { type: "string" },
    nextDate: { type: "string" },
  },
  required: ["summary", "agenda", "discussion", "decisions", "nextDate"],
  additionalProperties: false,
} as const;

function buildUserPrompt(input: MinutesGenerationInput): string {
  return [
    `委員会: ${input.committeeName}`,
    `開催日: ${input.date}`,
    input.attendees.length ? `出席者: ${input.attendees.join("、")}` : "",
    input.agendaHint.trim() ? `事前に入力された議題:\n${input.agendaHint.trim()}` : "",
    "",
    "<transcript>",
    input.transcript.trim(),
    "</transcript>",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY が設定されていません。サーバーの環境変数を確認してください。" }, { status: 500 });
  }

  const input = (await request.json()) as MinutesGenerationInput;
  const transcript = input.transcript?.trim() ?? "";
  if (!transcript) {
    return Response.json({ error: "文字起こしのテキストがありません。録音するか、テキストを貼り付けてください。" }, { status: 400 });
  }
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    return Response.json(
      { error: `文字起こしが長すぎます(${transcript.length.toLocaleString()}文字)。${MAX_TRANSCRIPT_CHARS.toLocaleString()}文字以内に分けて作成してください。` },
      { status: 400 }
    );
  }

  const client = new Anthropic();

  try {
    // 長い入力でもHTTPタイムアウトしないようストリーミングで受け取り、最後にまとめて取り出す。
    const stream = client.beta.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // 安全性の判定で断られた場合は、サーバー側で自動的に別モデルで再実行する。
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt({ ...input, transcript }) }],
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return Response.json({ error: "この内容ではAIによる議事録作成ができませんでした。手入力で作成してください。" }, { status: 422 });
    }
    if (message.stop_reason === "max_tokens") {
      return Response.json({ error: "議事録が長すぎて途中で切れました。文字起こしを分けて作成してください。" }, { status: 502 });
    }

    const text = message.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return Response.json({ error: "議事録の作成に失敗しました。もう一度お試しください。" }, { status: 502 });
    }
    const result = JSON.parse(text.text) as GeneratedMinutes;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result.nextDate)) result.nextDate = "";
    return Response.json(result);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "AIの利用が混み合っています。少し時間をおいてお試しください。" }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json({ error: `AIの呼び出しでエラーが発生しました(${error.status ?? "-"}): ${error.message}` }, { status: 502 });
    }
    const message = error instanceof Error ? error.message : "議事録の作成中にエラーが発生しました。";
    return Response.json({ error: message }, { status: 502 });
  }
}
