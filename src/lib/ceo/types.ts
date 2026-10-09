/**
 * Uchi AI CEO v1 — ドメイン型定義。
 * フィールド名・意味は docs/uchi-ai-ceo-v1/02-data-model.md の将来DBスキーマに揃えてある。
 */

export type Severity = "green" | "yellow" | "red";

export type ApprovalLevel = "L1" | "L2" | "L3" | "L4" | "L5" | "human_only";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "modified";

export type ExecutionStatus = "not_started" | "in_progress" | "done" | "n/a";

/** 20意思決定の識別子。Phase 0で実装するのは一部のみ(03-decision-engine.md参照)。 */
export type DecisionType =
  | "revenue_forecast"
  | "profit_forecast"
  | "branch_pl"
  | "kpi_anomaly"
  | "priority_ranking"
  | "nurse_productivity"
  | "branch_utilization"
  | "available_capacity"
  | "capacity_gap_forecast"
  | "required_hiring"
  | "new_patients_tracking"
  | "discharge_analysis"
  | "hospitalization_analysis"
  | "patient_forecast"
  | "required_new_patients"
  | "required_sales_activity"
  | "referral_source_stats"
  | "referral_source_ranking"
  | "workload_risk"
  | "recruitment_timing"
  | "care_manager_caseload";

/**
 * Uchi careグループの事業ライン。訪問看護(既存)に加え、同じ訪問時間ベースの
 * 訪問介護(Uchi Wel)、ケース数ベースの居宅介護支援、利用枠ベースの通所介護(UCHINOWA)を持つ。
 * 事業ラインごとに収益モデル・KPIが異なるため、型を分けている(02-data-model.md参照)。
 */
export type BusinessLine = "visiting_nurse" | "home_help" | "care_management" | "day_service";

export const BUSINESS_LINE_LABEL: Record<BusinessLine, string> = {
  visiting_nurse: "訪問看護",
  home_help: "訪問介護(Uchi Wel)",
  care_management: "居宅介護支援",
  day_service: "通所介護(UCHINOWA)",
};

/** 訪問看護(3拠点)の拠点名。 */
export const BRANCHES = ["仙台北", "仙台東", "鶴ヶ谷"] as const;
export type BranchName = (typeof BRANCHES)[number];

/** 訪問介護(Uchi Wel)の拠点名。訪問看護と同じ訪問時間ベースのモデルを共有する。 */
export const HOME_HELP_OFFICES = ["Uchi Wel 仙台"] as const;

/** 居宅介護支援の事業所名。 */
export const CARE_MANAGEMENT_OFFICES = ["Uchi care 居宅介護支援事業所"] as const;

/** 通所介護(UCHINOWA)の事業所名。 */
export const DAY_SERVICE_OFFICES = ["UCHINOWA"] as const;

/**
 * 拠点(branches) × financial_transactions × budgets × visits × patient_status_events の月次集計。
 * 訪問看護(visiting_nurse)と訪問介護(home_help)は、どちらも「訪問時間 × 単価」の収益モデルを
 * 共有するためこの型を共用する(businessLineで区別)。
 */
export interface BranchMonthlyMetric {
  businessLine: "visiting_nurse" | "home_help";
  branch: string;
  month: string; // "YYYY-MM"
  daysElapsed: number;
  daysInMonth: number;
  revenueActualMtd: number;
  revenueBudget: number;
  profitBudget: number;
  laborCost: number;
  variableCost: number;
  fixedCost: number;
  visitHours: number;
  availableHours: number;
  nurseCount: number;
  currentPatients: number;
  newPatients: number;
  dischargedPatients: number;
  hospitalizedPatients: number;
  resumedPatients: number;
  avgRevenuePerPatient: number;
  salesActivities: number;
  referrals: number;
  contracts: number;
}

/**
 * 居宅介護支援(ケアマネジャー事業)の月次集計。介護報酬は保有ケース数に対する
 * 月額報酬のため、訪問看護のような「訪問時間 × 単価」モデルではなく
 * 「ケース数 × 1件あたり単価」モデルで管理する。
 */
export interface CareManagementMonthlyMetric {
  businessLine: "care_management";
  office: string;
  month: string;
  daysElapsed: number;
  daysInMonth: number;
  currentCases: number; // 月初時点の保有ケース数
  newCases: number;
  lostCases: number; // 終了・他事業所への移管
  careManagerCount: number; // ケアマネジャー人数(常勤換算)
  targetCaseloadPerFte: number; // 1人あたり担当件数の目安上限
  avgFeePerCase: number; // 1ケースあたり月額報酬(居宅介護支援費)
  revenueBudget: number;
  profitBudget: number;
  laborCost: number;
  fixedCost: number;
}

/**
 * 通所介護(UCHINOWA / デイサービス)の月次集計。個人の訪問時間ではなく
 * 「1日あたり定員 × 営業日数」で決まる受け入れ可能延べ人数(キャパシティ)に対する
 * 稼働率で収益が決まるモデル。
 */
export interface DayServiceMonthlyMetric {
  businessLine: "day_service";
  office: string;
  month: string;
  daysElapsed: number;
  daysInMonth: number;
  operatingDays: number; // 当月営業日数
  capacityPerDay: number; // 1日あたり定員
  attendanceMtd: number; // MTD延べ利用者数
  currentUsers: number; // 月初時点の登録利用者数
  newUsers: number;
  endUsers: number;
  avgFeePerAttendance: number; // 1回あたり平均単価(各種加算込み)
  revenueBudget: number;
  profitBudget: number;
  laborCost: number;
  variableCost: number;
  fixedCost: number;
}

/** employees × visits × attendance の月次集計(職員個人名は含めるが、UIでは拠点+イニシャル表示に留める運用を想定) */
export interface NurseProductivityRecord {
  nurse: string;
  branch: string;
  month: string;
  visitProvidedHours: number;
  workHours: number;
  revenue: number;
  visitCount: number;
  workDays: number;
  travelHours: number;
}

export interface CeoDataset {
  branchMetrics: BranchMonthlyMetric[];
  careManagementMetrics: CareManagementMonthlyMetric[];
  dayServiceMetrics: DayServiceMonthlyMetric[];
  nurseProductivity: NurseProductivityRecord[];
  loadedAt: string;
  source: "mock" | "csv";
}

/** 使用データ・計算式・主要因・信頼度をユーザーが確認できるようにする(Explainability要件) */
export interface DecisionExplainability {
  dataUsed: string[];
  formula: string;
  mainFactors: { label: string; contribution: number }[];
  alternatives: string[];
}

export interface Decision {
  decisionId: string;
  decisionType: DecisionType;
  title: string;
  detectedAt: string;
  entityType: "company" | "branch" | "office" | "employee";
  entityId: string;
  entityLabel: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  gap: number;
  severity: Severity;
  probability: number; // 0-1
  recommendedAction: string;
  reasoningSummary: string;
  expectedImpact: string;
  confidenceScore: number; // 0-1
  requiredApprovalLevel: ApprovalLevel;
  approvalStatus: ApprovalStatus;
  approvedBy: string | null;
  executionStatus: ExecutionStatus;
  result: string | null;
  createdAt: string;
  updatedAt: string;
  priorityScore: number;
  explain: DecisionExplainability;
  aiNarrative: "pending" | "generated" | "fallback";
}

export interface AuditLogEntry {
  id: string;
  decisionId: string;
  action: "approve" | "reject" | "modify" | "view";
  actor: string;
  comment?: string;
  at: string;
}

export interface CompanyHealthBreakdown {
  score: number; // 0-100
  revenueComponent: number;
  profitComponent: number;
  utilizationComponent: number;
  severityComponent: number;
}
