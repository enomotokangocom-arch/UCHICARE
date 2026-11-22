export type ConsultationMode = "intake" | "responder";

export interface ConsultationAssistInput {
  mode: ConsultationMode;
  deskName: string;
  /** 相談内容(相談者が書いた文章、または担当者が受け取った相談) */
  text: string;
  /** 相談者の希望(対応方法など)。intake のみ */
  wishes?: string;
}

/** 相談者向け: 相談内容の整理 */
export interface IntakeResult {
  title: string;
  summary: string;
  timeline: string;
  requests: string;
  urgency: "高" | "中" | "低";
  /** 心身の安全に関わる緊急の内容が含まれるか */
  safetyConcern: boolean;
  messageToConsulter: string;
}

/** 担当者向け: 対応の整理と返信文案 */
export interface ResponderResult {
  keyPoints: string;
  risks: string;
  nextSteps: string;
  replyDraft: string;
}

export const MAX_CONSULTATION_CHARS = 20_000;
