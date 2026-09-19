// 採用CRM 共通定数
// マスタデータ（職種・エリア・タグ）は管理画面から追加・編集できますが、
// 初期シードデータや行動コードの意味づけはここで一元管理します。

export const OCCUPATION_CODES = [
  "JOB_NS",
  "JOB_PT",
  "JOB_OT",
  "JOB_ST",
  "JOB_CM",
  "JOB_OTHER",
] as const;

export const OCCUPATION_LABELS: Record<string, string> = {
  JOB_NS: "看護師",
  JOB_PT: "理学療法士(PT)",
  JOB_OT: "作業療法士(OT)",
  JOB_ST: "言語聴覚士(ST)",
  JOB_CM: "ケアマネジャー",
  JOB_OTHER: "その他",
};

export const TRANSFER_TIMING_LABELS: Record<string, string> = {
  TIME_NOW: "すぐに検討している",
  TIME_3M: "3ヶ月以内",
  TIME_6_12M: "半年〜1年以内",
  TIME_RESEARCH: "まだ情報収集中",
};

export const LEAD_STATUS_LABELS: Record<string, string> = {
  LEAD_COLD: "Cold",
  LEAD_WARM: "Warm",
  LEAD_HOT: "Hot",
};

export const CANDIDATE_STAGE_LABELS: Record<string, string> = {
  NURTURING: "育成中",
  CASUAL: "カジュアル面談",
  VISIT: "見学",
  APPLIED: "応募",
  INTERVIEW: "面接",
  OFFER: "内定",
  HIRED: "採用",
  DECLINED: "辞退",
};

export const CANDIDATE_STAGE_ORDER = [
  "NURTURING",
  "CASUAL",
  "VISIT",
  "APPLIED",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "DECLINED",
] as const;

// 行動データ由来のスコアリング対象イベントコード
export const ACTION_EVENT_CODES = {
  JOB_VIEW: "ACT_JOB_VIEW",
  QUESTION: "ACT_QUESTION",
  VISIT: "ACT_VISIT",
  CASUAL: "ACT_CASUAL",
  APPLY: "ACT_APPLY",
  STAFF_ARTICLE_VIEW: "ACT_STAFF_ARTICLE_VIEW",
  SALARY_VIEW: "ACT_SALARY_VIEW",
  LINE_REPLY: "ACT_LINE_REPLY",
  JOB_DETAIL_VIEW: "ACT_JOB_DETAIL_VIEW",
} as const;

// 選考ステータス関連イベント
export const RECRUITMENT_EVENT_CODES = {
  CONTACT: "REC_CONTACT",
  INTERVIEW: "REC_INTERVIEW",
  OFFER: "REC_OFFER",
  HIRED: "REC_HIRED",
  DECLINED: "REC_DECLINED",
} as const;

export const DEFAULT_LEAD_SCORE_RULES: Array<{
  actionCode: string;
  label: string;
  points: number;
}> = [
  { actionCode: ACTION_EVENT_CODES.STAFF_ARTICLE_VIEW, label: "スタッフ記事閲覧", points: 2 },
  { actionCode: ACTION_EVENT_CODES.JOB_VIEW, label: "求人情報閲覧", points: 5 },
  { actionCode: ACTION_EVENT_CODES.LINE_REPLY, label: "LINE返信", points: 5 },
  { actionCode: ACTION_EVENT_CODES.SALARY_VIEW, label: "給与情報閲覧", points: 5 },
  { actionCode: ACTION_EVENT_CODES.JOB_DETAIL_VIEW, label: "求人詳細閲覧", points: 10 },
  { actionCode: ACTION_EVENT_CODES.VISIT, label: "見学ボタン", points: 20 },
  { actionCode: ACTION_EVENT_CODES.CASUAL, label: "カジュアル面談", points: 30 },
  { actionCode: ACTION_EVENT_CODES.APPLY, label: "応募", points: 50 },
];

export const DEFAULT_TAGS: Array<{
  code: string;
  label: string;
  category: "OCCUPATION" | "TIMING" | "LEAD_STATUS" | "ACTION" | "RECRUITMENT";
}> = [
  ...OCCUPATION_CODES.map((code) => ({
    code,
    label: OCCUPATION_LABELS[code],
    category: "OCCUPATION" as const,
  })),
  ...Object.entries(TRANSFER_TIMING_LABELS).map(([code, label]) => ({
    code,
    label,
    category: "TIMING" as const,
  })),
  ...Object.entries(LEAD_STATUS_LABELS).map(([code, label]) => ({
    code,
    label,
    category: "LEAD_STATUS" as const,
  })),
  { code: "ACT_JOB_VIEW", label: "求人閲覧", category: "ACTION" },
  { code: "ACT_QUESTION", label: "質問あり", category: "ACTION" },
  { code: "ACT_VISIT", label: "見学希望", category: "ACTION" },
  { code: "ACT_CASUAL", label: "カジュアル面談希望", category: "ACTION" },
  { code: "ACT_APPLY", label: "応募", category: "ACTION" },
  { code: "REC_CONTACT", label: "選考連絡", category: "RECRUITMENT" },
  { code: "REC_INTERVIEW", label: "面接", category: "RECRUITMENT" },
  { code: "REC_OFFER", label: "内定", category: "RECRUITMENT" },
  { code: "REC_HIRED", label: "採用", category: "RECRUITMENT" },
  { code: "REC_DECLINED", label: "辞退", category: "RECRUITMENT" },
];

export const DEFAULT_AREAS = [
  "仙台市宮城野区",
  "仙台市青葉区",
  "仙台市その他",
  "宮城県内",
  "今後展開予定エリア",
  "特に決めていない",
];

export const DEFAULT_INFLOW_SOURCES: Array<{ code: string; name: string; channel: string }> = [
  { code: "INSTAGRAM", name: "Instagram", channel: "Instagram" },
  { code: "OFFICIAL_HP", name: "公式HP", channel: "公式HP" },
  { code: "INDEED", name: "Indeed", channel: "Indeed" },
  { code: "FLYER", name: "求人チラシ", channel: "求人チラシ" },
  { code: "STAFF_REFERRAL", name: "スタッフ紹介", channel: "スタッフ紹介" },
  { code: "UCHINOWA", name: "UCHINOWA", channel: "UCHINOWA" },
  { code: "EVENT", name: "イベント", channel: "イベント" },
  { code: "OFFICE_QR", name: "事業所QR", channel: "事業所QR" },
  { code: "OTHER", name: "その他", channel: "その他" },
];

export const NOTIFICATION_TYPES = {
  CASUAL_REQUEST: "CASUAL_REQUEST",
  VISIT_REQUEST: "VISIT_REQUEST",
  APPLICATION: "APPLICATION",
  LINE_QUESTION: "LINE_QUESTION",
  HOT_TRANSITION: "HOT_TRANSITION",
  STALE_CANDIDATE: "STALE_CANDIDATE",
  REHEARING_DUE: "REHEARING_DUE",
} as const;

export const STALE_CANDIDATE_DAYS = 7;
export const REHEARING_RESEARCH_DAYS = 90;
export const REHEARING_6_12M_DAYS = 180;
