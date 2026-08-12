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
 * 記事の構造的なSEO要件を機械的にチェックし、0〜100点のスコアを算出する。
 * LLMの自己採点ではなく、決定的なルールで判定することで承認基準として利用できるようにしている。
 */
export function computeSeoScore(article: SeoScoreInput): SeoScoreResult {
  const title = article.title ?? "";
  const meta = article.metaDescription ?? "";
  const body = article.body ?? "";
  const mainKeyword = article.mainKeyword?.trim() ?? "";

  const headingCount = (body.match(/^##\s+.+$/gm) ?? []).length;
  const mainKeywordOccurrences = mainKeyword ? body.split(mainKeyword).length - 1 : 0;
  const subKeywords = article.subKeywords ?? [];
  const subKeywordCoverageRatio =
    subKeywords.length === 0
      ? 1
      : subKeywords.filter((k) => body.includes(k)).length / subKeywords.length;
  const bodyCharCount = body.replace(/\s/g, "").length;

  const checks: SeoCheck[] = [
    {
      key: "titleKeyword",
      label: "タイトルにメインキーワードを含む",
      passed: mainKeyword !== "" && title.includes(mainKeyword),
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
      label: "メタディスクリプションにメインキーワードを含む",
      passed: mainKeyword !== "" && meta.includes(mainKeyword),
      weight: 15,
    },
    {
      key: "metaLength",
      label: "メタディスクリプションが100〜140文字",
      passed: meta.length >= 100 && meta.length <= 140,
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
      label: "本文にメインキーワードが2回以上登場",
      passed: mainKeywordOccurrences >= 2,
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
