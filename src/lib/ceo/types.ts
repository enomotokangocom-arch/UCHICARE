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
  | "recruitment_timing";

export const BRANCHES = ["仙台北", "仙台東", "宮城野"] as const;
export type BranchName = (typeof BRANCHES)[number];

/** branches × financial_transactions × budgets × visits × patient_status_events の月次集計 */
export interface BranchMonthlyMetric {
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
  entityType: "company" | "branch" | "employee";
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
