import { CEO_CONFIG } from "./config";
import { approvalLevelFor, baseDecision, priorityScore, yen } from "./decisionHelpers";
import {
  ProfitForecastResult,
  RevenueForecastResult,
  forecastBranchProfit,
  forecastBranchRevenue,
} from "./forecastEngine";
import { scoreAllNurses } from "./productivityEngine";
import { computeHiringPlan, computeRequiredSales } from "./salesEngine";
import { BranchMonthlyMetric, Decision, DecisionType, Severity } from "./types";

export function buildRevenueDecision(
  m: BranchMonthlyMetric,
  entityType: Decision["entityType"],
  entityId: string,
  entityLabel: string,
  now: string
): Decision {
  const f = forecastBranchRevenue(m);
  return buildRevenueDecisionFromForecast(f, entityType, entityId, entityLabel, now, false);
}

export function buildRevenueDecisionFromForecast(
  f: RevenueForecastResult,
  entityType: Decision["entityType"],
  entityId: string,
  entityLabel: string,
  now: string,
  isCompany = true
): Decision {
  const decisionType: DecisionType = "revenue_forecast";
  const prefix = isCompany ? "全社" : "";
  return {
    ...baseDecision(now, decisionType, entityType, entityId, entityLabel),
    title: `${entityLabel} 月末売上予測`,
    currentValue: f.forecastRevenue,
    targetValue: f.revenueBudget,
    unit: "円",
    gap: f.gap,
    severity: f.severity,
    probability: f.achievementProbability,
    recommendedAction:
      f.gap < 0
        ? `${prefix}売上Gap ${yen(Math.abs(f.gap))} の解消に向け、新規獲得・営業活動の強化を検討してください。`
        : "計画を上回る見込みです。現状の運営を継続してください。",
    reasoningSummary: `確定売上 ${yen(f.confirmedRevenue)} に残日数の想定売上 ${yen(f.scheduledVisitRevenue)} を加え、新規/終了/入院等の増減要因を反映した月末予測は ${yen(f.forecastRevenue)}(計画比 ${(f.gapRatio * 100).toFixed(1)}%)です。`,
    expectedImpact: `月末達成確率 ${(f.achievementProbability * 100).toFixed(0)}%`,
    confidenceScore: 0.8,
    requiredApprovalLevel: approvalLevelFor(decisionType),
    priorityScore: priorityScore({
      gap: f.gap,
      reference: f.revenueBudget,
      severity: f.severity,
      probability: f.achievementProbability,
      decisionType,
    }),
    explain: {
      dataUsed: ["日次売上(MTD)", "訪問予定", "新規/終了/入院/再開利用者数", "利用者あたり平均単価"],
      formula:
        "ForecastRevenue = ConfirmedRevenue + ScheduledVisitRevenue + ExpectedNewPatientRevenue + ExpectedResumptionRevenue - ExpectedDischargeImpact - ExpectedHospitalizationImpact - ExpectedCancellationImpact + ExpectedAddons",
      mainFactors: [
        { label: "確定売上(MTD)", contribution: f.confirmedRevenue },
        { label: "残日数の想定売上", contribution: f.scheduledVisitRevenue },
        { label: "新規利用者増収見込み", contribution: f.expectedNewPatientRevenue },
        { label: "終了利用者による減収見込み", contribution: -f.expectedDischargeImpact },
        { label: "入院による減収見込み", contribution: -f.expectedHospitalizationImpact },
      ],
      alternatives: ["残日数の訪問枠を追加販売する", "加算取得率を見直す", "キャンセル率の改善施策を実施する"],
    },
  };
}

export function buildProfitDecision(
  m: BranchMonthlyMetric,
  entityType: Decision["entityType"],
  entityId: string,
  entityLabel: string,
  now: string
): Decision {
  const f = forecastBranchProfit(m);
  return buildProfitDecisionFromForecast(f, entityType, entityId, entityLabel, now);
}

export function buildProfitDecisionFromForecast(
  f: ProfitForecastResult,
  entityType: Decision["entityType"],
  entityId: string,
  entityLabel: string,
  now: string
): Decision {
  const decisionType: DecisionType = "profit_forecast";
  return {
    ...baseDecision(now, decisionType, entityType, entityId, entityLabel),
    title: `${entityLabel} 月末利益予測`,
    currentValue: f.forecastProfit,
    targetValue: f.profitBudget,
    unit: "円",
    gap: f.gap,
    severity: f.severity,
    probability: 0.7,
    recommendedAction:
      f.gap < 0
        ? `利益Gap ${yen(Math.abs(f.gap))} は主に${f.revenueShortfallComponent < f.laborOverrunComponent ? "売上不足" : "コスト超過"}が要因です。原因に応じた是正を検討してください。`
        : "計画利益を上回る見込みです。",
    reasoningSummary: `売上予測 ${yen(f.forecastRevenue)} から人件費 ${yen(f.laborCost)}・変動費 ${yen(f.variableCost)}・固定費 ${yen(f.fixedCost)} を控除した利益予測は ${yen(f.forecastProfit)} です(計画 ${yen(f.profitBudget)})。`,
    expectedImpact: `利益Gap ${yen(f.gap)}`,
    confidenceScore: 0.75,
    requiredApprovalLevel: approvalLevelFor(decisionType),
    priorityScore: priorityScore({
      gap: f.gap,
      reference: f.profitBudget,
      severity: f.severity,
      probability: 0.7,
      decisionType,
    }),
    explain: {
      dataUsed: ["売上予測", "人件費", "変動費", "固定費", "計画利益"],
      formula: "ForecastProfit = ForecastRevenue - LaborCost - VariableCost - FixedCost",
      mainFactors: [
        { label: "売上要因", contribution: f.revenueShortfallComponent },
        { label: "人件費要因", contribution: f.laborOverrunComponent },
        { label: "その他固定費要因", contribution: f.otherFixedOverrunComponent },
      ],
      alternatives: ["残業時間の是正", "委託費の見直し", "売上改善施策の前倒し"],
    },
  };
}

export function buildProductivityDecision(
  branch: string,
  monthRecords: ReturnType<typeof scoreAllNurses>,
  now: string
): Decision | null {
  const branchRecords = monthRecords.filter((r) => r.branch === branch);
  const lowPerformers = branchRecords.filter((r) => r.isLowProductivity);
  if (lowPerformers.length === 0) return null;

  const avgClinicalUtilization =
    branchRecords.reduce((a, r) => a + r.clinicalUtilization, 0) / Math.max(1, branchRecords.length);

  const decisionType: DecisionType = "nurse_productivity";
  const severity: Severity = lowPerformers.length >= 3 ? "red" : "yellow";

  return {
    ...baseDecision(now, decisionType, "branch", branch, branch),
    title: `${branch} 訪問生産性の低下`,
    currentValue: Math.round(avgClinicalUtilization * 100),
    targetValue: Math.round(CEO_CONFIG.productivity.lowClinicalUtilization * 100),
    unit: "%",
    gap: Math.round((avgClinicalUtilization - CEO_CONFIG.productivity.lowClinicalUtilization) * 100),
    severity,
    probability: 0.6,
    recommendedAction: `Clinical Utilization もしくは移動効率が低い職員が${lowPerformers.length}名います。訪問件数だけでなくエリア配置・シフト設計を見直してください。`,
    reasoningSummary: `${branch}の職員${lowPerformers.length}名で、訪問提供時間/実勤務時間(Clinical Utilization)または訪問時間/(訪問時間+移動時間)(Travel Efficiency)が基準を下回っています。訪問件数のみでの評価は行っていません。`,
    expectedImpact: "エリア再配置により訪問生産性の改善が見込まれます。",
    confidenceScore: 0.65,
    requiredApprovalLevel: approvalLevelFor(decisionType),
    priorityScore: priorityScore({
      gap: lowPerformers.length,
      reference: 5,
      severity,
      probability: 0.6,
      decisionType,
    }),
    explain: {
      dataUsed: ["訪問提供時間", "実勤務時間", "訪問件数", "移動時間"],
      formula: "ClinicalUtilization=訪問提供時間/実勤務時間, TravelEfficiency=訪問時間/(訪問時間+移動時間)",
      mainFactors: lowPerformers.map((p) => ({ label: p.nurse, contribution: Math.round(p.clinicalUtilization * 100) })),
      alternatives: ["訪問エリアの再割当", "移動時間の多いルートの見直し", "同行研修によるスキルアップ支援"],
    },
  };
}

export function buildRequiredSalesDecision(m: BranchMonthlyMetric, now: string): Decision | null {
  const r = computeRequiredSales(m);
  if (r.requiredNewPatients <= 0.5) return null;

  const decisionType: DecisionType = "required_sales_activity";
  const severity: Severity = r.salesActivityGap > 10 ? "red" : r.salesActivityGap > 0 ? "yellow" : "green";

  return {
    ...baseDecision(now, decisionType, "branch", m.branch, m.branch),
    title: `${m.branch} 必要営業量の不足`,
    currentValue: r.currentSalesActivity,
    targetValue: r.requiredSalesActivity,
    unit: "件/月",
    gap: r.salesActivityGap,
    severity,
    probability: r.cvrConfidence,
    recommendedAction: `売上Gap ${yen(r.revenueGap)} を埋めるには新規利用者 ${r.requiredNewPatients}名(紹介 ${r.requiredReferrals}件、営業活動 ${r.requiredSalesActivity}件)が必要です。現在の営業活動(${r.currentSalesActivity}件)では${r.salesActivityGap}件不足しています。営業リソースの追加を検討してください。`,
    reasoningSummary: `必要新規利用者数 = 売上Gap ÷ 平均単価 = ${r.requiredNewPatients}名。必要営業量 = 必要紹介件数(${r.requiredReferrals}件) ÷ 営業→紹介CVR(${(r.salesToReferralCvr * 100).toFixed(0)}%)= ${r.requiredSalesActivity}件。`,
    expectedImpact: `新規 +${r.requiredNewPatients}名 / 月商 +${yen(r.revenueGap)}`,
    confidenceScore: r.cvrConfidence,
    requiredApprovalLevel: approvalLevelFor(decisionType),
    priorityScore: priorityScore({
      gap: r.revenueGap,
      reference: m.revenueBudget,
      severity,
      probability: r.cvrConfidence,
      decisionType,
    }),
    explain: {
      dataUsed: ["売上予測Gap", "利用者あたり平均単価", "紹介件数", "契約件数", "営業活動件数"],
      formula:
        "RequiredNewPatients=RevenueGap/AvgRevenuePerPatient, RequiredReferrals=RequiredNewPatients/ReferralToContractCVR, RequiredSalesActivity=RequiredReferrals/SalesToReferralCVR",
      mainFactors: [
        { label: "売上Gap", contribution: r.revenueGap },
        { label: "紹介→契約CVR", contribution: Math.round(r.referralToContractCvr * 100) },
        { label: "営業→紹介CVR", contribution: Math.round(r.salesToReferralCvr * 100) },
      ],
      alternatives: ["既存営業先への接触頻度を増やす", "新規営業先の開拓", "紹介率の高いチャネルへの営業集中"],
    },
  };
}

export function buildHiringDecision(series: BranchMonthlyMetric[], now: string, today: Date): Decision | null {
  const plan = computeHiringPlan(series, today);
  if (plan.requiredFte <= 0 || !plan.projectedShortageDate) return null;

  const decisionType: DecisionType = "required_hiring";
  const severity: Severity =
    plan.isRecruitmentOverdue || (plan.shortageHorizonDays !== null && plan.shortageHorizonDays <= 30) ? "red" : "yellow";
  const gapHours = plan.capacityGaps.find((g) => g.horizonDays === plan.shortageHorizonDays)?.capacityGapHours ?? 0;

  return {
    ...baseDecision(now, decisionType, "branch", plan.branch, plan.branch),
    title: `${plan.branch} 採用開始タイミング`,
    currentValue: 0,
    targetValue: plan.requiredFte,
    unit: "FTE",
    gap: -plan.requiredFte,
    severity,
    probability: 0.6,
    recommendedAction: plan.isRecruitmentOverdue
      ? `${plan.projectedShortageDate}頃に ${plan.requiredFte}FTE(約${Math.ceil(plan.requiredFte)}名)の供給不足が見込まれます。平均採用期間(${CEO_CONFIG.capacity.avgHiringLeadTimeDays}日)を踏まえると求人開始が既に必要な時期です。直ちに求人を開始してください(最終的な採用可否・人数決定は人間が行います)。`
      : `${plan.projectedShortageDate}頃に ${plan.requiredFte}FTE(約${Math.ceil(plan.requiredFte)}名)の供給不足が見込まれます。平均採用期間(${CEO_CONFIG.capacity.avgHiringLeadTimeDays}日)を踏まえ、${plan.recruitmentStartDate}までに求人を開始してください(最終的な採用可否・人数決定は人間が行います)。`,
    reasoningSummary: `${plan.shortageHorizonDays}日後の必要訪問時間が確保可能時間を ${yen(gapHours)}相当上回る見込みです。RequiredFTE = CapacityGapHours ÷ 1FTEあたり月間訪問可能時間(${CEO_CONFIG.capacity.avgProductiveHoursPerFte}h)。`,
    expectedImpact: `採用完了により供給不足を解消(必要人数 ${Math.ceil(plan.requiredFte)}名)`,
    confidenceScore: 0.6,
    requiredApprovalLevel: "human_only",
    priorityScore: priorityScore({
      gap: gapHours,
      reference: CEO_CONFIG.capacity.avgProductiveHoursPerFte,
      severity,
      probability: 0.6,
      decisionType,
    }),
    explain: {
      dataUsed: ["拠点別訪問時間", "訪問提供可能時間", "利用者数トレンド(直近3ヶ月)", "平均採用リードタイム"],
      formula:
        "CapacityGapHours=FutureRequiredVisitHours-FutureAvailableStaffHours, RequiredFTE=CapacityGapHours/AvgProductiveHoursPerFTE, RecruitmentStartDate=ProjectedShortageDate-AvgHiringLeadTimeDays",
      mainFactors: plan.capacityGaps.map((g) => ({ label: `${g.horizonDays}日後の供給ギャップ`, contribution: g.capacityGapHours })),
      alternatives: ["非常勤・パート採用での補強", "他拠点からの応援", "訪問頻度の最適化による稼働時間の圧縮"],
    },
  };
}

export function buildUtilizationDecision(m: BranchMonthlyMetric, rate: number, severity: Severity, now: string): Decision {
  const decisionType: DecisionType = "branch_utilization";
  return {
    ...baseDecision(now, decisionType, "branch", m.branch, m.branch),
    title: `${m.branch} 稼働率低下`,
    currentValue: Math.round(rate * 1000) / 10,
    targetValue: Math.round(CEO_CONFIG.utilization.targetRate * 1000) / 10,
    unit: "%",
    gap: Math.round((rate - CEO_CONFIG.utilization.targetRate) * 1000) / 10,
    severity,
    probability: 0.7,
    recommendedAction: "空き訪問枠の活用、または営業活動による新規獲得で稼働率を改善してください。",
    reasoningSummary: `稼働率(訪問時間/訪問提供可能時間)が ${(rate * 100).toFixed(1)}% で、目標 ${(CEO_CONFIG.utilization.targetRate * 100).toFixed(0)}% を下回っています。`,
    expectedImpact: "稼働率改善により追加受け入れ余力が確保できます。",
    confidenceScore: 0.7,
    requiredApprovalLevel: approvalLevelFor(decisionType),
    priorityScore: priorityScore({
      gap: rate - CEO_CONFIG.utilization.targetRate,
      reference: 1,
      severity,
      probability: 0.7,
      decisionType,
    }),
    explain: {
      dataUsed: ["訪問時間", "訪問提供可能時間"],
      formula: "UtilizationRate = 訪問時間 / 訪問提供可能時間",
      mainFactors: [{ label: "稼働率", contribution: Math.round(rate * 100) }],
      alternatives: ["空き訪問枠への新規利用者割当", "営業活動の強化"],
    },
  };
}
