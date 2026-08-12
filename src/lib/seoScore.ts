export interface SeoCheck {
  key: string;
  label: string;
  passed: boolean;
  weight: number;
}

export interface SeoScoreResult {
  score: number;
  checks: SeoCheck[];
}

export interface SeoScoreInput {
  title: string;
  metaDescription: string;
  body: string;
  mainKeyword: string;
  subKeywords: string[];
  callToAction: string;
}

/** 自動承認・自動公開のしきい値。この点数未満の記事は承認・公開できない。 */
export const SEO_APPROVAL_THRESHOLD = 90;

/**
 * 「世田谷区 訪問看護」のようなスペース区切りのキーワードを単語(トークン)に分割する。
 * 自然な日本語の文章では単語間に助詞(の・と・で 等)が入るため、
 * キーワード全体を1つの連続した文字列として一致させるのではなく、単語単位で含有をチェックする。
 */
function keywordTokens(keyword: string): string[] {
  return keyword
    .trim()
    .split(/[\s　]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function allTokensIncluded(tokens: string[], text: string): boolean {
  return tokens.length > 0 && tokens.every((t) => text.includes(t));
}

function countTokenOccurrences(tokens: string[], text: string): number {
  return tokens.reduce((sum, t) => sum + (text.split(t).length - 1), 0);
}

/**
 * 記事の構造的なSEO要件を機械的にチェックし、0〜100点のスコアを算出する。
 * LLMの自己採点ではなく、決定的なルールで判定することで承認基準として利用できるようにしている。
 */
export function computeSeoScore(article: SeoScoreInput): SeoScoreResult {
  const title = article.title ?? "";
  const meta = article.metaDescription ?? "";
  const body = article.body ?? "";
  const mainKeywordTokens = keywordTokens(article.mainKeyword ?? "");

  const headingCount = (body.match(/^##\s+.+$/gm) ?? []).length;
  const mainKeywordBodyOccurrences = countTokenOccurrences(mainKeywordTokens, body);
  const subKeywords = article.subKeywords ?? [];
  const subKeywordCoverageRatio =
    subKeywords.length === 0
      ? 1
      : subKeywords.filter((k) => body.includes(k)).length / subKeywords.length;
  const bodyCharCount = body.replace(/\s/g, "").length;

  const checks: SeoCheck[] = [
    {
      key: "titleKeyword",
      label: "タイトルにメインキーワードの単語を含む",
      passed: allTokensIncluded(mainKeywordTokens, title),
      weight: 20,
    },
    {
      key: "titleLength",
      label: "タイトルが32文字以内",
      passed: title.length > 0 && title.length <= 32,
      weight: 10,
    },
    {
      key: "metaKeyword",
      label: "メタディスクリプションにメインキーワードの単語を含む",
      passed: allTokensIncluded(mainKeywordTokens, meta),
      weight: 15,
    },
    {
      key: "metaLength",
      label: "メタディスクリプションが90〜140文字",
      passed: meta.length >= 90 && meta.length <= 140,
      weight: 10,
    },
    {
      key: "headingCount",
      label: "見出し(##)が3つ以上",
      passed: headingCount >= 3,
      weight: 15,
    },
    {
      key: "keywordDensity",
      label: "本文にメインキーワードの単語が繰り返し登場(目安:各単語2回以上)",
      passed: mainKeywordBodyOccurrences >= mainKeywordTokens.length * 2,
      weight: 15,
    },
    {
      key: "subKeywords",
      label: "サブキーワードの半数以上を本文に含む",
      passed: subKeywordCoverageRatio >= 0.5,
      weight: 5,
    },
    {
      key: "bodyLength",
      label: "本文が600字以上",
      passed: bodyCharCount >= 600,
      weight: 5,
    },
    {
      key: "cta",
      label: "行動喚起(CTA)が設定されている",
      passed: article.callToAction.trim().length >= 10,
      weight: 5,
    },
  ];

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earnedWeight = checks.filter((c) => c.passed).reduce((sum, c) => sum + c.weight, 0);
  const score = Math.round((earnedWeight / totalWeight) * 100);

  return { score, checks };
}
