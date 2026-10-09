import { CEO_CONFIG } from "./config";
import { forecastCareManagementProfit, forecastCareManagementRevenue } from "./careManagementEngine";
import { forecastDayServiceProfit, forecastDayServiceRevenue } from "./dayServiceEngine";
import { approvalLevelFor, baseDecision, priorityScore, yen } from "./decisionHelpers";
import {
  ProfitForecastResult,
  RevenueForecastResult,
  forecastBranchProfit,
  forecastBranchRevenue,
  severityFromGapRatio,
} from "./forecastEngine";
import { scoreAllNurses } from "./productivityEngine";
import { computeHiringPlan, computeRequiredSales } from "./salesEngine";
import { BranchMonthlyMetric, CareManagementMonthlyMetric, DayServiceMonthlyMetric, Decision, DecisionType, Severity } from "./types";

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

export function buildCareManagementRevenueDecision(m: CareManagementMonthlyMetric, now: string): Decision {
  const f = forecastCareManagementRevenue(m);
  const decisionType: DecisionType = "revenue_forecast";
  return {
    ...baseDecision(now, decisionType, "office", m.office, m.office),
    title: `${m.office} 月末売上予測`,
    currentValue: f.forecastRevenue,
    targetValue: f.revenueBudget,
    unit: "円",
    gap: f.gap,
    severity: f.severity,
    probability: 0.65,
    recommendedAction:
      f.gap < 0
        ? `保有ケース数見込み ${f.forecastCases}件(目標 ${m.careManagerCount * m.targetCaseloadPerFte}件相当)では売上Gap ${yen(Math.abs(f.gap))} が発生する見込みです。新規ケース受け入れ・紹介元との連携強化を検討してください。`
        : "計画を上回る見込みです。",
    reasoningSummary: `新規ケース ${m.newCases}件・終了ケース ${m.lostCases}件を反映した月末保有ケース数見込みは ${f.forecastCases}件。1件あたり月額報酬 ${yen(m.avgFeePerCase)} を乗じた売上予測は ${yen(f.forecastRevenue)}(計画比 ${(f.gapRatio * 100).toFixed(1)}%)です。`,
    expectedImpact: `保有ケース数見込み ${f.forecastCases}件`,
    confidenceScore: 0.7,
    requiredApprovalLevel: approvalLevelFor(decisionType),
    priorityScore: priorityScore({ gap: f.gap, reference: f.revenueBudget, severity: f.severity, probability: 0.65, decisionType }),
    explain: {
      dataUsed: ["保有ケース数", "新規ケース数", "終了ケース数", "1件あたり月額報酬(居宅介護支援費)"],
      formula: "ForecastRevenue = (CurrentCases + NewCases - LostCases) × AvgFeePerCase",
      mainFactors: [
        { label: "新規ケース", contribution: m.newCases * m.avgFeePerCase },
        { label: "終了ケース", contribution: -m.lostCases * m.avgFeePerCase },
      ],
      alternatives: ["地域包括支援センター・医療機関への営業強化", "他事業所からのケース移管受け入れ"],
    },
  };
}

export function buildCareManagementProfitDecision(m: CareManagementMonthlyMetric, now: string): Decision {
  const f = forecastCareManagementProfit(m);
  const decisionType: DecisionType = "profit_forecast";
  return {
    ...baseDecision(now, decisionType, "office", m.office, m.office),
    title: `${m.office} 月末利益予測`,
    currentValue: f.forecastProfit,
    targetValue: f.profitBudget,
    unit: "円",
    gap: f.gap,
    severity: f.severity,
    probability: 0.65,
    recommendedAction: f.gap < 0 ? `利益Gap ${yen(Math.abs(f.gap))}。人件費・固定費に対しケース数が不足しています。` : "計画利益を上回る見込みです。",
    reasoningSummary: `売上予測 ${yen(f.forecastRevenue)} から人件費 ${yen(f.laborCost)}・固定費 ${yen(f.fixedCost)} を控除した利益予測は ${yen(f.forecastProfit)} です(計画 ${yen(f.profitBudget)})。`,
    expectedImpact: `利益Gap ${yen(f.gap)}`,
    confidenceScore: 0.65,
    requiredApprovalLevel: approvalLevelFor(decisionType),
    priorityScore: priorityScore({ gap: f.gap, reference: f.profitBudget, severity: f.severity, probability: 0.65, decisionType }),
    explain: {
      dataUsed: ["居宅介護支援の売上予測", "人件費", "固定費", "計画利益"],
      formula: "ForecastProfit = ForecastRevenue - LaborCost - FixedCost",
      mainFactors: [
        { label: "売上要因", contribution: f.forecastRevenue - f.profitBudget - f.laborCost - f.fixedCost },
        { label: "人件費", contribution: -f.laborCost },
      ],
      alternatives: ["ケアマネジャーの増員・配置見直し", "固定費の見直し"],
    },
  };
}

/** ケアマネジャー1人あたり担当件数の過多を検知する(逓減制等を踏まえた目安に対する比率)。 */
export function buildCaseloadDecision(m: CareManagementMonthlyMetric, now: string): Decision | null {
  const f = forecastCareManagementRevenue(m);
  if (f.caseloadSeverity === "green") return null;

  const decisionType: DecisionType = "care_manager_caseload";
  return {
    ...baseDecision(now, decisionType, "office", m.office, m.office),
    title: `${m.office} ケアマネジャー担当件数の過多`,
    currentValue: f.caseloadPerFte,
    targetValue: m.targetCaseloadPerFte,
    unit: "件/人",
    gap: Math.round((f.caseloadPerFte - m.targetCaseloadPerFte) * 10) / 10,
    severity: f.caseloadSeverity,
    probability: 0.6,
    recommendedAction: `1人あたり担当件数が目安(${m.targetCaseloadPerFte}件)を${((f.caseloadRatio - 1) * 100).toFixed(0)}%上回っています。新規ケースの受け入れペースの調整、またはケアマネジャーの増員を検討してください。`,
    reasoningSummary: `保有ケース数見込み ${f.forecastCases}件 ÷ ケアマネジャー ${m.careManagerCount}名 = 1人あたり ${f.caseloadPerFte}件(目安 ${m.targetCaseloadPerFte}件)。過重労働・支援品質低下のリスクとして扱います(個人の評価ではありません)。`,
    expectedImpact: "増員または受け入れペース調整により、ケアマネジャー1人あたりの負荷を適正化",
    confidenceScore: 0.6,
    requiredApprovalLevel: approvalLevelFor(decisionType),
    priorityScore: priorityScore({
      gap: f.caseloadPerFte - m.targetCaseloadPerFte,
      reference: m.targetCaseloadPerFte,
      severity: f.caseloadSeverity,
      probability: 0.6,
      decisionType,
    }),
    explain: {
      dataUsed: ["保有ケース数見込み", "ケアマネジャー人数", "1人あたり担当件数の目安"],
      formula: "CaseloadPerFte = ForecastCases / CareManagerCount",
      mainFactors: [{ label: "1人あたり担当件数", contribution: Math.round(f.caseloadPerFte * 10) / 10 }],
      alternatives: ["ケアマネジャーの増員", "新規ケース受け入れペースの調整", "他事業所への一部移管"],
    },
  };
}

export function buildDayServiceRevenueDecision(m: DayServiceMonthlyMetric, now: string): Decision {
  const f = forecastDayServiceRevenue(m);
  const decisionType: DecisionType = "revenue_forecast";
  return {
    ...baseDecision(now, decisionType, "office", m.office, m.office),
    title: `${m.office} 月末売上予測`,
    currentValue: f.forecastRevenue,
    targetValue: f.revenueBudget,
    unit: "円",
    gap: f.gap,
    severity: f.severity,
    probability: 0.65,
    recommendedAction:
      f.gap < 0
        ? `稼働率 ${(f.utilizationRate * 100).toFixed(1)}% のままでは売上Gap ${yen(Math.abs(f.gap))} が発生する見込みです。新規利用者の受け入れ・稼働率改善を検討してください。`
        : "計画を上回る見込みです。",
    reasoningSummary: `確定延べ利用者数 ${f.confirmedAttendance}人 に残営業日の想定利用者数 ${f.scheduledAttendance}人 を加えた月末延べ利用見込みは ${f.forecastAttendance}人。平均単価 ${yen(m.avgFeePerAttendance)} を乗じた売上予測は ${yen(f.forecastRevenue)}(計画比 ${(f.gapRatio * 100).toFixed(1)}%)です。`,
    expectedImpact: `月末稼働率見込み ${(f.utilizationRate * 100).toFixed(1)}%`,
    confidenceScore: 0.7,
    requiredApprovalLevel: approvalLevelFor(decisionType),
    priorityScore: priorityScore({ gap: f.gap, reference: f.revenueBudget, severity: f.severity, probability: 0.65, decisionType }),
    explain: {
      dataUsed: ["MTD延べ利用者数", "1日あたり定員", "営業日数", "平均単価"],
      formula: "ForecastRevenue = (ConfirmedAttendance + ScheduledAttendance) × AvgFeePerAttendance",
      mainFactors: [
        { label: "確定延べ利用者数", contribution: f.confirmedAttendance * m.avgFeePerAttendance },
        { label: "残営業日の想定利用者数", contribution: f.scheduledAttendance * m.avgFeePerAttendance },
      ],
      alternatives: ["送迎エリアの拡大", "空き枠の新規利用者への割当", "ケアマネジャーへの空き枠案内"],
    },
  };
}

export function buildDayServiceProfitDecision(m: DayServiceMonthlyMetric, now: string): Decision {
  const f = forecastDayServiceProfit(m);
  const decisionType: DecisionType = "profit_forecast";
  return {
    ...baseDecision(now, decisionType, "office", m.office, m.office),
    title: `${m.office} 月末利益予測`,
    currentValue: f.forecastProfit,
    targetValue: f.profitBudget,
    unit: "円",
    gap: f.gap,
    severity: f.severity,
    probability: 0.65,
    recommendedAction: f.gap < 0 ? `利益Gap ${yen(Math.abs(f.gap))}。稼働率不足によるコスト吸収不足が主要因です。` : "計画利益を上回る見込みです。",
    reasoningSummary: `売上予測 ${yen(f.forecastRevenue)} から人件費 ${yen(f.laborCost)}・変動費 ${yen(f.variableCost)}・固定費 ${yen(f.fixedCost)} を控除した利益予測は ${yen(f.forecastProfit)} です(計画 ${yen(f.profitBudget)})。`,
    expectedImpact: `利益Gap ${yen(f.gap)}`,
    confidenceScore: 0.65,
    requiredApprovalLevel: approvalLevelFor(decisionType),
    priorityScore: priorityScore({ gap: f.gap, reference: f.profitBudget, severity: f.severity, probability: 0.65, decisionType }),
    explain: {
      dataUsed: ["通所介護の売上予測", "人件費", "変動費", "固定費", "計画利益"],
      formula: "ForecastProfit = ForecastRevenue - LaborCost - VariableCost - FixedCost",
      mainFactors: [
        { label: "売上要因", contribution: f.forecastRevenue - f.profitBudget - f.laborCost - f.variableCost - f.fixedCost },
        { label: "人件費", contribution: -f.laborCost },
      ],
      alternatives: ["稼働率改善による売上増", "人員配置・シフトの見直し"],
    },
  };
}

export function buildDayServiceUtilizationDecision(m: DayServiceMonthlyMetric, now: string): Decision | null {
  const f = forecastDayServiceRevenue(m);
  if (f.utilizationSeverity === "green") return null;

  const decisionType: DecisionType = "branch_utilization";
  return {
    ...baseDecision(now, decisionType, "office", m.office, m.office),
    title: `${m.office} 稼働率低下`,
    currentValue: Math.round(f.utilizationRate * 1000) / 10,
    targetValue: Math.round(CEO_CONFIG.dayService.targetUtilization * 1000) / 10,
    unit: "%",
    gap: Math.round((f.utilizationRate - CEO_CONFIG.dayService.targetUtilization) * 1000) / 10,
    severity: f.utilizationSeverity,
    probability: 0.7,
    recommendedAction: "空き枠の新規利用者への割当、ケアマネジャーへの空き枠案内など稼働率改善策を検討してください。",
    reasoningSummary: `稼働率(延べ利用者数/受入可能延べ人数)が ${(f.utilizationRate * 100).toFixed(1)}% で、目標 ${(CEO_CONFIG.dayService.targetUtilization * 100).toFixed(0)}% を下回っています。`,
    expectedImpact: "稼働率改善により固定費の回収率が向上します。",
    confidenceScore: 0.7,
    requiredApprovalLevel: approvalLevelFor(decisionType),
    priorityScore: priorityScore({
      gap: f.utilizationRate - CEO_CONFIG.dayService.targetUtilization,
      reference: 1,
      severity: f.utilizationSeverity,
      probability: 0.7,
      decisionType,
    }),
    explain: {
      dataUsed: ["MTD延べ利用者数", "1日あたり定員", "営業日数"],
      formula: "UtilizationRate = MTD延べ利用者数 / (1日あたり定員 × MTD営業日数)",
      mainFactors: [{ label: "稼働率", contribution: Math.round(f.utilizationRate * 100) }],
      alternatives: ["空き枠への新規利用者割当", "ケアマネジャーへの空き枠案内", "送迎エリアの拡大"],
    },
  };
}

export interface BusinessLineTotal {
  label: string;
  forecastValue: number;
  budget: number;
}

/** 事業ライン別の売上予測を合算した、Uchi careグループ全社の月末売上予測Decision。 */
export function buildCompanyRevenueDecision(parts: BusinessLineTotal[], now: string): Decision {
  const forecastRevenue = parts.reduce((a, p) => a + p.forecastValue, 0);
  const revenueBudget = parts.reduce((a, p) => a + p.budget, 0);
  const gap = forecastRevenue - revenueBudget;
  const gapRatio = revenueBudget !== 0 ? gap / revenueBudget : 0;
  const severity = severityFromGapRatio(gapRatio);
  const achievementProbability = Math.min(0.95, Math.max(0.05, 0.5 + gapRatio * 5));
  const decisionType: DecisionType = "revenue_forecast";

  return {
    ...baseDecision(now, decisionType, "company", "company", "全社(Uchi careグループ)"),
    title: "全社 月末売上予測",
    currentValue: forecastRevenue,
    targetValue: revenueBudget,
    unit: "円",
    gap,
    severity,
    probability: achievementProbability,
    recommendedAction:
      gap < 0
        ? `全社売上Gap ${yen(Math.abs(gap))}。事業ライン別の内訳を確認し、未達幅の大きい事業へ経営資源を再配分してください。`
        : "全社で計画を上回る見込みです。",
    reasoningSummary: `訪問看護・訪問介護(Uchi Wel)・居宅介護支援・通所介護(UCHINOWA)の4事業ラインを合算した全社の月末売上予測は ${yen(forecastRevenue)}(計画比 ${(gapRatio * 100).toFixed(1)}%)です。`,
    expectedImpact: `月末達成確率 ${(achievementProbability * 100).toFixed(0)}%`,
    confidenceScore: 0.75,
    requiredApprovalLevel: approvalLevelFor(decisionType),
    priorityScore: priorityScore({ gap, reference: revenueBudget, severity, probability: achievementProbability, decisionType }),
    explain: {
      dataUsed: ["事業ライン別 月末売上予測(4事業ライン合算)"],
      formula: "全社ForecastRevenue = Σ 事業ライン別ForecastRevenue",
      mainFactors: parts.map((p) => ({ label: p.label, contribution: p.forecastValue - p.budget })),
      alternatives: ["未達幅の大きい事業ラインへ経営資源を再配分する"],
    },
  };
}

/** 事業ライン別の利益予測を合算した、Uchi careグループ全社の月末利益予測Decision。 */
export function buildCompanyProfitDecision(parts: BusinessLineTotal[], now: string): Decision {
  const forecastProfit = parts.reduce((a, p) => a + p.forecastValue, 0);
  const profitBudget = parts.reduce((a, p) => a + p.budget, 0);
  const gap = forecastProfit - profitBudget;
  const gapRatio = profitBudget !== 0 ? gap / Math.abs(profitBudget) : 0;
  const severity = severityFromGapRatio(gapRatio);
  const decisionType: DecisionType = "profit_forecast";

  return {
    ...baseDecision(now, decisionType, "company", "company", "全社(Uchi careグループ)"),
    title: "全社 月末利益予測",
    currentValue: forecastProfit,
    targetValue: profitBudget,
    unit: "円",
    gap,
    severity,
    probability: 0.7,
    recommendedAction:
      gap < 0
        ? `全社利益Gap ${yen(Math.abs(gap))}。事業ライン別の内訳を確認し、要因の大きい事業から是正してください。`
        : "全社で計画利益を上回る見込みです。",
    reasoningSummary: `訪問看護・訪問介護(Uchi Wel)・居宅介護支援・通所介護(UCHINOWA)の4事業ラインを合算した全社の月末利益予測は ${yen(forecastProfit)}(計画 ${yen(profitBudget)})です。`,
    expectedImpact: `利益Gap ${yen(gap)}`,
    confidenceScore: 0.7,
    requiredApprovalLevel: approvalLevelFor(decisionType),
    priorityScore: priorityScore({ gap, reference: profitBudget, severity, probability: 0.7, decisionType }),
    explain: {
      dataUsed: ["事業ライン別 月末利益予測(4事業ライン合算)"],
      formula: "全社ForecastProfit = Σ 事業ライン別ForecastProfit",
      mainFactors: parts.map((p) => ({ label: p.label, contribution: p.forecastValue - p.budget })),
      alternatives: ["利益Gapが大きい事業ラインのコスト構造を個別に見直す"],
    },
  };
}
