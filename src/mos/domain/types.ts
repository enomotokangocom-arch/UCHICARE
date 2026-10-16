// ドメイン層で使う型（Prisma の enum と同じ文字列値）

export type Unit = "COMPANY" | "HOMONKANGO" | "KYOTAKU" | "HQ";
export type BusinessUnit = "HOMONKANGO" | "KYOTAKU";
export const BUSINESS_UNITS: BusinessUnit[] = ["HOMONKANGO", "KYOTAKU"];

export const UNIT_LABEL: Record<Unit, string> = {
  COMPANY: "全社",
  HOMONKANGO: "訪問看護",
  KYOTAKU: "居宅支援",
  HQ: "本部",
};

export type Bank = "GMO" | "SENDAI";

export type SourceType =
  | "BANK_GMO"
  | "BANK_SENDAI"
  | "KYOTAKU_SALES_XLSX"
  | "TRIAL_BALANCE_PDF"
  | "IBOW_SALES_CSV"
  | "IBOW_IMPLEMENTATION_XLSX"
  | "ZEST_METRICS_ZIP"
  | "UNKNOWN";

export const SOURCE_LABEL: Record<SourceType, string> = {
  BANK_GMO: "GMOあおぞらネット銀行 明細",
  BANK_SENDAI: "仙台銀行 明細",
  KYOTAKU_SALES_XLSX: "居宅売上管理表",
  TRIAL_BALANCE_PDF: "残高試算表（年間推移・部門別）",
  IBOW_SALES_CSV: "iBow 月次売上（SalesList）",
  IBOW_IMPLEMENTATION_XLSX: "iBow 訪問実績（Implementation）",
  ZEST_METRICS_ZIP: "ZEST 経営指標",
  UNKNOWN: "不明",
};

export type Severity = "ERROR" | "WARNING" | "INFO";

export type Issue = {
  severity: Severity;
  code: string;
  message: string;
  sheet?: string;
  rowNumber?: number;
  column?: string;
};

export type TxCategory =
  | "EXPENSE"
  | "PAYROLL"
  | "TAX_SOCIAL"
  | "INTERNAL_TRANSFER"
  | "CARD_SETTLEMENT"
  | "LOAN_PRINCIPAL"
  | "LOAN_REPAYMENT_MIXED"
  | "LOAN_INTEREST"
  | "REVENUE_RECEIPT"
  | "OTHER_INCOME"
  | "UNCLASSIFIED";

export const TX_CATEGORY_LABEL: Record<TxCategory, string> = {
  EXPENSE: "経費",
  PAYROLL: "給与",
  TAX_SOCIAL: "税・社会保険",
  INTERNAL_TRANSFER: "口座間振替",
  CARD_SETTLEMENT: "カード引落",
  LOAN_PRINCIPAL: "借入元金返済",
  LOAN_REPAYMENT_MIXED: "借入返済（元利一括）",
  LOAN_INTEREST: "借入利息",
  REVENUE_RECEIPT: "売上入金",
  OTHER_INCOME: "その他入金",
  UNCLASSIFIED: "未分類",
};

/** 推計損益の費用に含めるカテゴリ（それ以外は二重計上・営業外のため除外） */
export const EXPENSE_CATEGORIES: TxCategory[] = ["EXPENSE", "PAYROLL"];

export type CostAllocation = "DIRECT" | "COMMON" | "HQ";
export type CostBehavior = "LABOR" | "FIXED" | "VARIABLE";

export const ALLOCATION_LABEL: Record<CostAllocation, string> = {
  DIRECT: "直接費",
  COMMON: "共通費",
  HQ: "本部費",
};
export const BEHAVIOR_LABEL: Record<CostBehavior, string> = {
  LABOR: "人件費",
  FIXED: "固定費",
  VARIABLE: "変動費",
};

export type AccountSection =
  | "REVENUE"
  | "REVENUE_ADJUSTMENT"
  | "COGS"
  | "SGA"
  | "NON_OPERATING_INCOME"
  | "NON_OPERATING_EXPENSE"
  | "EXTRAORDINARY"
  | "SUBTOTAL";

export type AccountInfo = {
  name: string;
  section: AccountSection;
  behavior: CostBehavior | null;
  allocation: CostAllocation | null;
  sortOrder: number;
};

export type ValueStatus = "ESTIMATED" | "RECONCILED" | "FINAL";
export const VALUE_STATUS_LABEL: Record<ValueStatus, string> = {
  ESTIMATED: "推計",
  RECONCILED: "照合済",
  FINAL: "確定",
};

export type JobType = "NURSE" | "PT" | "OT" | "ST" | "CARE_MANAGER" | "OTHER";
export const JOB_TYPE_LABEL: Record<JobType, string> = {
  NURSE: "看護師",
  PT: "理学療法士",
  OT: "作業療法士",
  ST: "言語聴覚士",
  CARE_MANAGER: "ケアマネジャー",
  OTHER: "その他",
};

export type Role = "ADMIN" | "MANAGER" | "STAFF";
export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "経営者",
  MANAGER: "事務・管理者",
  STAFF: "職員",
};
