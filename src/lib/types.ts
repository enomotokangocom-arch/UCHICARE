export type SurveyType = "ergonomics" | "stressCheck" | "backPain" | "caregiving";

export type RiskLevel = "low" | "medium" | "high";

export type Department =
  | "介護・福祉サービス部"
  | "製造部"
  | "物流部"
  | "営業部"
  | "管理部門";

export const DEPARTMENTS: Department[] = [
  "介護・福祉サービス部",
  "製造部",
  "物流部",
  "営業部",
  "管理部門",
];

/** アンケートの1問。polarity: positive=回答値が高いほど健康的、negative=回答値が高いほどリスクが高い */
export interface QuestionDef {
  id: string;
  text: string;
  polarity: "positive" | "negative";
}

export interface SurveyDef {
  type: SurveyType;
  title: string;
  shortTitle: string;
  description: string;
  icon: string;
  accentColor: string;
  scaleLabels: [string, string, string, string];
  questions: QuestionDef[];
  resultLabels: Record<RiskLevel, string>;
  resultAdvice: Record<RiskLevel, string>;
}

export interface SurveySubmission {
  id: string;
  type: SurveyType;
  department: Department;
  respondentLabel: string;
  submittedAt: string; // ISO date string
  answers: number[]; // 1-4 per question, same order as SurveyDef.questions
  score: number; // 0-100, 100 = 最も健康的/低リスク
  level: RiskLevel;
}

export interface CategoryAggregate {
  type: SurveyType;
  averageScore: number;
  level: RiskLevel;
  responseCount: number;
  highRiskCount: number;
}

export interface DepartmentAggregate {
  department: Department;
  overallScore: number;
  categoryScores: Record<SurveyType, number | null>;
  responseCount: number;
}

export interface MonthlyTrendPoint {
  month: string; // "2026-02" 形式
  label: string; // "2月" 表示用
  overallScore: number;
  categoryScores: Record<SurveyType, number>;
}

/** セミナー資料PDFを生成した記録。1日1テーマの生成ローテーションに使う。 */
export interface SeminarGeneratedLog {
  date: string; // "YYYY-MM-DD" 形式(生成した日)
  topicId: string;
  generatedAt: string; // ISO日時
}
