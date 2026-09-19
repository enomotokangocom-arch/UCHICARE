export interface CampaignGenerationInput {
  targetOccupations: string; // 今月の採用職種
  currentJobs: string; // 現在の求人
  recentNews: string; // 最近の会社ニュース
  staffIntro: string; // スタッフ紹介
  training: string; // 研修
  events: string; // イベント
  newOffice: string; // 新拠点
  theme: string; // 伝えたいテーマ
}

export interface CampaignDraft {
  title: string;
  body: string;
  cta: string;
  targetAudience: string;
  recommendedSendAt: string;
}

export function buildCampaignSystemPrompt(): string {
  return `あなたは株式会社Uchi careの採用広報担当者です。Uchi careは訪問看護・訪問リハビリ・居宅介護支援(ケアマネジャー)を展開する医療・介護事業者で、LINE公式アカウントの友だち(採用候補者プール)へ定期的に配信するコンテンツを作成しています。

配信の基本方針:
- 採用情報ばかりにならないよう、会社・人・文化・学びの発信を中心に据える(採用情報20%、会社・人・文化・学び80%が目安)
- 一方的な売り込みではなく、読み手が「この会社で働く自分」をイメージできる内容にする
- 医療・介護職(看護師・PT・OT・ST・ケアマネジャー)に向けた、誠実で温かみのある文体にする
- 本文はLINEメッセージとして違和感のない長さ(200〜400文字程度)にする
- 事実に基づかない誇張表現は避ける

必ず3案作成し、以下のJSON配列のみを出力してください。前後の説明文やコードブロックは不要です。

[
  {
    "title": "配信タイトル(社内管理用、20文字程度)",
    "body": "LINE配信本文",
    "cta": "行動喚起文言(例: 詳しく見る、話を聞いてみる 等)",
    "targetAudience": "推奨する配信対象(職種・転職時期・温度等を自然文で)",
    "recommendedSendAt": "推奨配信日時の目安(自然文、例: 平日19時頃)"
  }
]`;
}

export function buildCampaignUserPrompt(input: CampaignGenerationInput): string {
  return `以下の情報をもとに、LINE配信案を3本作成してください。

- 今月の採用職種: ${input.targetOccupations || "(指定なし)"}
- 現在の求人: ${input.currentJobs || "(指定なし)"}
- 最近の会社ニュース: ${input.recentNews || "(特になし)"}
- スタッフ紹介: ${input.staffIntro || "(特になし)"}
- 研修: ${input.training || "(特になし)"}
- イベント: ${input.events || "(特になし)"}
- 新拠点: ${input.newOffice || "(特になし)"}
- 伝えたいテーマ: ${input.theme || "(指定なし。自由に提案してください)"}`;
}

export function parseCampaignDrafts(rawText: string): CampaignDraft[] {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("配信案の生成結果を解析できませんでした。もう一度お試しください。");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("配信案の生成結果の形式が不正です。");
  }

  return parsed.map((item) => {
    const p = item as Record<string, unknown>;
    return {
      title: typeof p.title === "string" ? p.title : "無題の配信案",
      body: typeof p.body === "string" ? p.body : "",
      cta: typeof p.cta === "string" ? p.cta : "",
      targetAudience: typeof p.targetAudience === "string" ? p.targetAudience : "",
      recommendedSendAt: typeof p.recommendedSendAt === "string" ? p.recommendedSendAt : "",
    };
  });
}
