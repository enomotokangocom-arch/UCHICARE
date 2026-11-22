import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { ConsultationAssistInput, MAX_CONSULTATION_CHARS } from "@/lib/consultationTypes";

export const runtime = "nodejs";
export const maxDuration = 60;

const COMMON = `あなたは訪問看護・居宅介護支援を運営する株式会社Uchi careの社内相談窓口のアシスタントです。
相談内容は職員にとってとてもデリケートなものです。次のことを必ず守ってください。
- 相談者を責めたり、事実を決めつけたりしない。ハラスメントに当たるかどうか等の判定はしない(判断は担当者が行う)。
- 書かれていない事実を足さない。不明な点は「不明」「確認が必要」と書く。
- 相談に出てくる第三者の氏名はそのまま残してよいが、評価や憶測は書かない。
- 自傷・他害・暴力・身の危険につながる内容があれば safetyConcern を true にし、緊急度を「高」にする。
- 文体はやさしく丁寧な「です・ます」調。箇条書きは「・」で始める。`;

const INTAKE_PROMPT = `${COMMON}

相談者が書いた文章を、担当者に伝わりやすいよう整理してください。
- title: 相談の件名(20字以内)
- summary: 相談の要点(3〜5行)
- timeline: いつ・どこで・誰が・何があったかの経緯(わかる範囲で箇条書き)
- requests: 相談者の希望(どうしてほしいか・対応方法の希望)
- urgency: 高・中・低
- safetyConcern: 身の安全に関わる緊急性があるか
- messageToConsulter: 相談者への受付メッセージ。相談してくれたことへの感謝、内容は担当者以外に共有されないこと、担当者から連絡があることを、短く温かく伝える(担当者名や日数は書かない)。`;

const RESPONDER_PROMPT = `${COMMON}

担当者が受け取った相談について、対応の準備を手伝ってください。
- keyPoints: 相談の要点と、事実として確認できていること・まだ確認が必要なこと
- risks: 配慮が必要な点(相談者の心身の状態、二次被害・不利益取扱いの防止、プライバシー、緊急性など)
- nextSteps: 担当者が取るとよい次の対応(面談の設定、事実確認の進め方、関係者への対応、記録の残し方、必要に応じた外部窓口や専門家への相談など)を、順番に箇条書き
- replyDraft: 相談者へ最初に送る返信文の下書き。受け止めと感謝、守秘、面談などの提案を含め、事実の評価や約束できないことは書かない。`;

const SCHEMAS = {
  intake: {
    type: "object",
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      timeline: { type: "string" },
      requests: { type: "string" },
      urgency: { type: "string", enum: ["高", "中", "低"] },
      safetyConcern: { type: "boolean" },
      messageToConsulter: { type: "string" },
    },
    required: ["title", "summary", "timeline", "requests", "urgency", "safetyConcern", "messageToConsulter"],
    additionalProperties: false,
  },
  responder: {
    type: "object",
    properties: {
      keyPoints: { type: "string" },
      risks: { type: "string" },
      nextSteps: { type: "string" },
      replyDraft: { type: "string" },
    },
    required: ["keyPoints", "risks", "nextSteps", "replyDraft"],
    additionalProperties: false,
  },
} as const;

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY が設定されていません。サーバーの環境変数を確認してください。" }, { status: 500 });
  }
  const input = (await request.json()) as ConsultationAssistInput;
  const text = input.text?.trim() ?? "";
  if (input.mode !== "intake" && input.mode !== "responder") {
    return Response.json({ error: "不正なリクエストです。" }, { status: 400 });
  }
  if (!text) return Response.json({ error: "相談内容を入力してください。" }, { status: 400 });
  if (text.length > MAX_CONSULTATION_CHARS) {
    return Response.json({ error: `文章が長すぎます(${MAX_CONSULTATION_CHARS.toLocaleString()}文字まで)。` }, { status: 400 });
  }

  const userContent = [
    `相談窓口: ${input.deskName}`,
    input.wishes?.trim() ? `相談者の希望: ${input.wishes.trim()}` : "",
    "",
    "<consultation>",
    text,
    "</consultation>",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const client = new Anthropic();
  try {
    const stream = client.beta.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMAS[input.mode] } },
      system: input.mode === "intake" ? INTAKE_PROMPT : RESPONDER_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      return Response.json({ error: "この内容ではAIによる整理ができませんでした。そのまま送信するか、担当者に直接ご相談ください。" }, { status: 422 });
    }
    if (message.stop_reason === "max_tokens") {
      return Response.json({ error: "整理した内容が長すぎて途中で切れました。文章を短くしてお試しください。" }, { status: 502 });
    }
    const block = message.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return Response.json({ error: "AIによる整理に失敗しました。もう一度お試しください。" }, { status: 502 });
    }
    return Response.json(JSON.parse(block.text));
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "AIの利用が混み合っています。少し時間をおいてお試しください。" }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json({ error: `AIの呼び出しでエラーが発生しました(${error.status ?? "-"}): ${error.message}` }, { status: 502 });
    }
    return Response.json({ error: error instanceof Error ? error.message : "AIによる整理中にエラーが発生しました。" }, { status: 502 });
  }
}
