import {
  ArticleGenerationInput,
  ARTICLE_TOPIC_CATEGORY_DEFS,
  GeneratedArticleContent,
  LENGTH_HINT_DEFS,
  TARGET_AUDIENCE_DEFS,
} from "./articleTypes";

/** 記事生成APIのシステムプロンプトを組み立てる。 */
export function buildArticleSystemPrompt(): string {
  return `あなたは株式会社Uchi careのオウンドメディア編集者兼SEOライターです。Uchi careは保健師・療法士・ケアマネジャーが監修する在宅介護・地域医療連携サービスを提供しており、自社ホームページの記事を通じて次の2つを実現したい。

1. 検索エンジンで自社HPの掲載順位を上げる(SEO対策されたキーワード設計)
2. 記事を読んだ「地域の方・ご家族」「ケアマネジャー」「医師・医療機関」が、Uchi careへの利用相談・紹介・問い合わせをしたくなること

記事作成にあたっての方針:
- 指定されたメインキーワード・サブキーワードを、タイトル・見出し・本文冒頭・本文中に不自然にならない範囲で盛り込むこと(キーワードの詰め込みすぎ=キーワードスタッフィングは避ける)
- タイトルは32文字前後を目安に、検索意図に合致し、クリックしたくなる具体性を持たせること
- メタディスクリプションは110〜130文字程度で、記事の要点と行動喚起を含めること
- 本文は見出し(##)で構成し、結論を先に示すこと。医療・介護の専門用語には平易な補足を添え、事実に基づかない断定的な医学的主張は避けること(一般的な情報提供に留め、個別の医療判断を促す表現にする)
- 対象読者ごとに響く言葉遣いを意識すること。地域の方には安心感、ケアマネジャーには連携のしやすさ・情報共有のスムーズさ、医師には医学的な信頼性・退院支援や在宅移行の円滑さを重視すること
- 記事の最後に、対象読者が行動したくなる自然な行動喚起(お問い合わせ・見学予約・資料請求・紹介依頼など)を含めること
- 個人が特定される実例は書かず、一般化した事例として書くこと
- 日本語として自然で、Web記事として読みやすい文体(丁寧語)で書くこと

出力は必ず以下のJSONオブジェクトのみを返すこと。前後に説明文やコードブロックのバッククォートを含めないこと。

{
  "title": "記事タイトル(文字列)",
  "metaDescription": "メタディスクリプション(文字列)",
  "outline": ["見出し1", "見出し2", "..."],
  "body": "Markdown形式の本文。見出しは## から始める",
  "targetKeywords": ["想定される検索キーワード", "..."],
  "callToAction": "記事末尾に配置する行動喚起文(文字列)"
}`;
}

/** 記事生成APIのユーザープロンプト(生成条件)を組み立てる。 */
export function buildArticleUserPrompt(input: ArticleGenerationInput): string {
  const audiences = input.targetAudiences
    .map((a) => `${TARGET_AUDIENCE_DEFS[a].label}(${TARGET_AUDIENCE_DEFS[a].description})`)
    .join(" / ");
  const subKeywords = input.subKeywords.length > 0 ? input.subKeywords.join("、") : "(指定なし)";
  const lengthDef = LENGTH_HINT_DEFS[input.lengthHint];
  const topicDef = ARTICLE_TOPIC_CATEGORY_DEFS[input.topicCategory];

  return `次の条件で記事を1本作成してください。

- メインキーワード: ${input.mainKeyword}
- サブキーワード: ${subKeywords}
- 対象読者: ${audiences || "(指定なし。一般的な読者を想定)"}
- 記事カテゴリ: ${topicDef.label}(${topicDef.hint})
- 文字数の目安: ${lengthDef.label}(${lengthDef.chars})
${input.notes.trim() ? `- 補足指示: ${input.notes.trim()}` : ""}`;
}

/** Claudeの応答テキストから記事JSONを取り出す(コードブロックで囲まれていても対応)。 */
export function parseGeneratedArticle(rawText: string): GeneratedArticleContent {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("記事の生成結果を解析できませんでした。もう一度お試しください。");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("title" in parsed) ||
    !("body" in parsed)
  ) {
    throw new Error("記事の生成結果の形式が不正です。もう一度お試しください。");
  }

  const p = parsed as Record<string, unknown>;

  return {
    title: typeof p.title === "string" ? p.title : "",
    metaDescription: typeof p.metaDescription === "string" ? p.metaDescription : "",
    outline: Array.isArray(p.outline) ? p.outline.filter((x): x is string => typeof x === "string") : [],
    body: typeof p.body === "string" ? p.body : "",
    targetKeywords: Array.isArray(p.targetKeywords)
      ? p.targetKeywords.filter((x): x is string => typeof x === "string")
      : [],
    callToAction: typeof p.callToAction === "string" ? p.callToAction : "",
  };
}
