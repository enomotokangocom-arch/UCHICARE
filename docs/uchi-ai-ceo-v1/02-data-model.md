# データモデル設計

## 1. 将来のDBスキーマ(Phase 1以降 / PostgreSQL想定)

仕様書6章に基づく最低限のテーブル一覧。すべて `organization_id` を持ち multi-tenant を前提とする。
Phase 0ではDBを持たないため実装しないが、`src/lib/ceo/types.ts` のPhase 0型はこのスキーマと
フィールド名・意味を揃えてあり、Phase 1でそのままマッピングできる。

```
organizations(id, name, plan, created_at)
branches(id, organization_id, name, code, address, created_at)
employees(id, organization_id, branch_id, name, hired_at, employment_type, status)
employee_roles(id, employee_id, role, valid_from, valid_to)
patients(id, organization_id, branch_id, name_hash, contract_status, referral_source_id, started_at, avg_unit_price)
patient_status_events(id, patient_id, event_type[new|discharge|hospitalization|resumption|...], reason, occurred_at)
visits(id, organization_id, branch_id, patient_id, employee_id, scheduled_start, scheduled_end,
       actual_start, actual_end, travel_minutes, revenue, addons, status)
visit_schedules(id, organization_id, branch_id, employee_id, date, planned_minutes)
work_shifts(id, employee_id, date, start_time, end_time, shift_type[day|night|on_call])
attendance(id, employee_id, date, work_minutes, overtime_minutes, on_call, night_dispatch, consecutive_days)
payroll(id, employee_id, month, base_salary, overtime_pay, incentive, employer_social_insurance)
financial_transactions(id, organization_id, branch_id, month, category, amount, type[revenue|labor|variable|fixed])
budgets(id, organization_id, branch_id, month, revenue_budget, profit_budget)
sales_activities(id, organization_id, branch_id, referral_source_id, employee_id, occurred_at, activity_type, notes)
referral_sources(id, organization_id, branch_id, name, type, sales_owner_id, last_contact_at)
referrals(id, referral_source_id, patient_id, referred_at, converted)
contracts(id, patient_id, referral_id, contracted_at, monthly_revenue_estimate)
recruitment_candidates(id, organization_id, branch_id, role, source_channel_id, applied_at, status)
recruitment_channels(id, organization_id, name, avg_lead_time_days, cost)
incidents(id, organization_id, branch_id, patient_id, employee_id, severity, category, occurred_at, description)
kpis(id, organization_id, branch_id, kpi_type, month, value)
kpi_targets(id, organization_id, branch_id, kpi_type, month, target_value, yellow_threshold, red_threshold)
forecasts(id, organization_id, branch_id, forecast_type, target_month, expected, low, high, confidence, computed_at)
decisions(id, organization_id, decision_type, detected_at, entity_type, entity_id, current_value, target_value,
          gap, severity, probability, recommended_action, reasoning_summary, expected_impact, confidence_score,
          required_approval_level, approval_status, approved_by, execution_status, result, created_at, updated_at)
decision_actions(id, decision_id, action_type, payload, executed_at, executed_by, status)
approvals(id, decision_id, approver_id, decision[approve|reject|modify], comment, decided_at)
notifications(id, organization_id, decision_id, priority[P0|P1|P2|P3], channel, sent_at, read_at)
```

Row Level Security(RLS)を `organization_id` で全テーブルに適用し、テナント分離を行う想定。

## 2. Phase 0 ドメイン型(`src/lib/ceo/types.ts`)

Phase 0はDBを持たないため、CSV/モックデータから直接生成される軽量な型を用いる。
将来のテーブルとの対応関係をコメントで明示する。

### `BranchMonthlyMetric`(branches × financial_transactions × budgets × visits × patient_status_events の月次集計に相当)

```ts
interface BranchMonthlyMetric {
  branch: string;            // branches.name
  month: string;              // "YYYY-MM"
  daysElapsed: number;         // 当月の経過日数(予測の基準日)
  daysInMonth: number;
  revenueActualMtd: number;    // 当月・月初からの確定売上(financial_transactions type=revenue)
  revenueBudget: number;       // budgets.revenue_budget
  profitBudget: number;        // budgets.profit_budget
  laborCost: number;           // 当月見込み人件費(payroll集計)
  variableCost: number;
  fixedCost: number;
  visitHours: number;          // 当月・訪問提供時間(visits集計)
  availableHours: number;      // 訪問提供可能時間(work_shifts集計)
  nurseCount: number;
  currentPatients: number;     // 月初時点の利用者数
  newPatients: number;         // patient_status_events type=new
  dischargedPatients: number;  // type=discharge(終了利用者、疾患改善・転居等含む)
  hospitalizedPatients: number;// type=hospitalization
  resumedPatients: number;     // type=resumption
  avgRevenuePerPatient: number;// 利用者あたり平均月商
  salesActivities: number;     // sales_activities件数
  referrals: number;           // referrals件数
  contracts: number;           // contracts件数
}
```

### `NurseProductivityRecord`(employees × visits × attendance の月次集計に相当)

```ts
interface NurseProductivityRecord {
  nurse: string;               // employees.name
  branch: string;
  month: string;
  visitProvidedHours: number;  // 訪問提供時間
  workHours: number;           // 実勤務時間
  revenue: number;             // 訪問売上
  visitCount: number;          // 訪問件数
  workDays: number;            // 勤務日数
  travelHours: number;         // 移動時間
}
```

### `Decision`(decisions テーブルに1:1対応)

```ts
interface Decision {
  decisionId: string;
  decisionType: DecisionType;              // 20種のうちPhase0は6種
  detectedAt: string;                       // ISO date
  entityType: "company" | "branch" | "employee";
  entityId: string;
  currentValue: number;
  targetValue: number;
  gap: number;
  severity: "green" | "yellow" | "red";
  probability: number;                      // 0-1
  recommendedAction: string;
  reasoningSummary: string;
  expectedImpact: string;
  confidenceScore: number;                  // 0-1
  requiredApprovalLevel: "L1" | "L2" | "L3" | "L4" | "L5" | "human_only";
  approvalStatus: "pending" | "approved" | "rejected" | "modified";
  approvedBy: string | null;
  executionStatus: "not_started" | "in_progress" | "done" | "n/a";
  result: string | null;
  createdAt: string;
  updatedAt: string;
  explain: DecisionExplainability;          // 11章 Explainability要件
}

interface DecisionExplainability {
  dataUsed: string[];       // 使用したデータ項目
  formula: string;          // 計算式(人間可読)
  mainFactors: { label: string; contribution: number }[]; // 主要因(金額/件数寄与度)
  alternatives: string[];   // 代替案
}
```

## 3. Multi-tenant / PII 方針

Phase 0はシングルテナント(株式会社Uchi care)固定だが、全型に `organizationId?: string` を予約フィールドとして
持たせ、Phase 1でのマルチテナント化時にマイグレーション不要な形にする。
氏名等の患者個人情報はPhase 0のモック/CSVでは扱わず(拠点・職員・集計値のみ)、LLMへ送信するのは
`Decision` の集計値・比率のみとする(12章 セキュリティ方針に準拠)。
