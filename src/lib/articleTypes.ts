export type TargetAudience = "resident" | "careManager" | "doctor";

export const TARGET_AUDIENCE_DEFS: Record<
  TargetAudience,
  { label: string; description: string }
> = {
  resident: {
    label: "地域の方・ご家族",
    description: "在宅介護を検討している地域住民やそのご家族",
  },
  careManager: {
    label: "ケアマネジャー",
    description: "利用者への紹介先を探している居宅介護支援事業所のケアマネジャー",
  },
  doctor: {
    label: "医師・医療機関",
    description: "退院支援や在宅療養で連携先を探している医師・地域医療機関",
  },
};

export type ArticleTopicCategory =
  | "serviceIntro"
  | "caseStudy"
  | "usefulInfo"
  | "staffIntro"
  | "areaInfo"
  | "faq";

export const ARTICLE_TOPIC_CATEGORY_DEFS: Record<
  ArticleTopicCategory,
  { label: string; hint: string }
> = {
  serviceIntro: { label: "サービス紹介", hint: "提供サービスの内容・特徴・強みを紹介" },
  caseStudy: { label: "利用事例・ケーススタディ", hint: "支援事例や利用者の変化を紹介(個人が特定されない形で)" },
  usefulInfo: { label: "お役立ち情報", hint: "介護・医療に関する知識やノウハウを解説" },
  staffIntro: { label: "スタッフ・体制紹介", hint: "スタッフの専門性や事業所の連携体制を紹介" },
  areaInfo: { label: "地域情報", hint: "対応エリアや地域の医療・介護資源との連携を紹介" },
  faq: { label: "よくある質問", hint: "利用検討者からよくある質問に回答" },
};

export interface ArticleGenerationInput {
  mainKeyword: string;
  subKeywords: string[];
  targetAudiences: TargetAudience[];
  topicCategory: ArticleTopicCategory;
  lengthHint: "short" | "medium" | "long";
  notes: string;
}

export const LENGTH_HINT_DEFS: Record<ArticleGenerationInput["lengthHint"], { label: string; chars: string }> = {
  short: { label: "短め", chars: "600〜900字" },
  medium: { label: "標準", chars: "1200〜1800字" },
  long: { label: "しっかり", chars: "2000〜2800字" },
};

export interface GeneratedArticleContent {
  title: string;
  metaDescription: string;
  outline: string[];
  body: string;
  targetKeywords: string[];
  callToAction: string;
}

export type ArticleStatus = "draft" | "approved" | "published";

export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: "下書き",
  approved: "承認済み・公開待ち",
  published: "公開済み",
};

export interface Article extends GeneratedArticleContent {
  id: string;
  createdAt: string;
  status: ArticleStatus;
  approvedAt: string | null;
  publishedAt: string | null;
  mainKeyword: string;
  subKeywords: string[];
  targetAudiences: TargetAudience[];
  topicCategory: ArticleTopicCategory;
}
