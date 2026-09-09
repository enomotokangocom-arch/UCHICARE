// Rule / Anomaly Engine — Phase2本実装 (07-decision-rules.md の20ルール全て)。
// 閾値は resolveThresholds() でAnomalyThresholdテーブルの値を優先し、未設定ならデフォルト値を使う。

import type { KpiEntry } from "@/server/uchi-os/kpi-engine/compute";
import type { KpiTrendPoint } from "@/server/uchi-os/kpi-engine/trend";
import type { EmployeeWorkload } from "@/server/uchi-os/kpi-engine/workforce-detail";
import type { ReferralSourceDetail } from "@/server/uchi-os/kpi-engine/referral-detail";
import { forecastLinear } from "@/server/uchi-os/forecast-engine/simple-forecast";
import { computeConfidence } from "./confidence";
import type { ThresholdDefaults } from "./thresholds";

export type Severity = "INFO" | "WARNING" | "CRITICAL";

export interface RootCauseFactor {
  label: string;
  kpiCode: string;
  value: number | null;
}

export interface RecommendedAction {
  title: string;
  description: string;
  approvalCategory?: string;
}

export interface RuleFinding {
  ruleCode: string;
  severity: Severity;
  title: string;
  problemSummary: string;
  rootCause: { factors: RootCauseFactor[] };
  predictedImpact: number | null;
  confidence: number;
  recommendedActions: RecommendedAction[];
}

export type KpiMap = Map<string, KpiEntry>;

export function toKpiMap(entries: KpiEntry[]): KpiMap {
  return new Map(entries.map((e) => [e.kpiCode, e]));
}

function val(kpis: KpiMap, code: string): number | null {
  const entry = kpis.get(code);
  if (!entry || entry.insufficientData) return null;
  return entry.value;
}

/** getKpiTrend()の結果(古い→新しい)から、指定KPIの値配列を取り出す。 */
function series(trend: KpiTrendPoint[], kpiCode: string): (number | null)[] {
  return trend.map((p) => p.values[kpiCode] ?? null);
}

function average(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** 配列末尾から連続してpredicateを満たす件数を数える(nullは非該当として打ち切る)。 */
function trailingStreak(values: (number | null)[], predicate: (v: number) => boolean): number {
  let count = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v == null || !predicate(v)) break;
    count += 1;
  }
  return count;
}

/** DR-01 と同じ「予測影響」の考え方(当月と前月の実額差)を汎用化。 */
function impactFromMoM(currentValue: number | null, momPct: number | null): number | null {
  if (currentValue == null || momPct == null) return null;
  const prevValue = currentValue / (1 + momPct / 100);
  return Math.round(currentValue - prevValue);
}

// ============================================================
// DR-01 売上低下
// ============================================================
export function evaluateRevenueDecline(stationName: string, kpis: KpiMap, t: ThresholdDefaults): RuleFinding | null {
  const revenueMoM = val(kpis, "revenue_mom");
  const revenue = val(kpis, "monthly_revenue");
  if (revenueMoM == null || revenueMoM > t.revenue_drop_warn_pct) return null;

  const severity: Severity = revenueMoM <= t.revenue_drop_critical_pct ? "CRITICAL" : "WARNING";
  const newPatients = val(kpis, "new_patients");
  const endedPatients = val(kpis, "ended_patients");
  const utilizationRate = val(kpis, "utilization_rate");

  const factors: RootCauseFactor[] = [];
  if (endedPatients != null && endedPatients > 0) {
    factors.push({ label: "利用終了増加", kpiCode: "ended_patients", value: endedPatients });
  }
  if (newPatients != null) factors.push({ label: "新規利用開始", kpiCode: "new_patients", value: newPatients });
  if (utilizationRate != null && utilizationRate < 75) {
    factors.push({ label: "看護師稼働率低下", kpiCode: "utilization_rate", value: utilizationRate });
  }

  const dataCompleteness = [revenueMoM, revenue, newPatients, endedPatients].filter((v) => v != null).length / 4;
  const signalStrength = Math.min(1, Math.abs(revenueMoM) / Math.abs(t.revenue_drop_warn_pct));

  return {
    ruleCode: "DR-01",
    severity,
    title: `${stationName}の月間売上が前月比${revenueMoM.toFixed(1)}%低下`,
    problemSummary: `${stationName}の月間売上が前月比${revenueMoM.toFixed(1)}%低下しています。`,
    rootCause: { factors },
    predictedImpact: impactFromMoM(revenue, revenueMoM),
    confidence: computeConfidence({ dataCompleteness, signalStrength }),
    recommendedActions: [
      { title: `${stationName}への営業活動集中`, description: "今週の営業活動を対象拠点へ重点配分する。" },
      { title: "過去90日で紹介実績のある紹介元への再訪", description: "紹介実績のある居宅介護支援事業所等へ優先的に再訪する。" },
      { title: "新規採用の一時保留を検討", description: "稼働率が低い場合は採用計画を見直す(DR-16参照)。" },
      { title: "管理者との15分レビュー", description: "拠点管理者と状況を共有し、現場要因を確認する。" },
    ],
  };
}

// ============================================================
// DR-02 売上予測未達 (Forecast Engine簡易版、線形回帰による翌月予測)
// ============================================================
export function evaluateRevenueForecastMiss(
  stationName: string,
  trend: KpiTrendPoint[],
  t: ThresholdDefaults,
): RuleFinding | null {
  const revenueSeries = series(trend, "monthly_revenue");
  const forecastNextMonth = forecastLinear(revenueSeries.slice(-6), 1);
  // 予算の代理指標: 前年同月実績。データが無ければ直近3ヶ月平均で代替する(06章のフォールバック方針)。
  const budget = revenueSeries.length >= 12 ? revenueSeries[revenueSeries.length - 12] : average(revenueSeries.slice(-3));

  if (forecastNextMonth == null || budget == null || budget === 0) return null;
  const gapPct = ((forecastNextMonth - budget) / budget) * 100;
  if (gapPct > t.forecast_gap_warn_pct) return null;

  return {
    ruleCode: "DR-02",
    severity: gapPct <= t.forecast_gap_warn_pct * 2 ? "CRITICAL" : "WARNING",
    title: `${stationName}の翌月売上予測が予算比${gapPct.toFixed(1)}%未達見込み`,
    problemSummary: `${stationName}の翌月売上は、直近6ヶ月のトレンドから${Math.round(forecastNextMonth).toLocaleString(
      "ja-JP",
    )}円と予測され、予算(前年同月等)比${gapPct.toFixed(1)}%の未達が見込まれます。`,
    rootCause: {
      factors: [
        { label: "翌月売上予測(線形回帰)", kpiCode: "monthly_revenue", value: Math.round(forecastNextMonth) },
        { label: "予算(前年同月/直近平均)", kpiCode: "monthly_revenue", value: Math.round(budget) },
      ],
    },
    predictedImpact: Math.round(forecastNextMonth - budget),
    confidence: computeConfidence({ dataCompleteness: revenueSeries.filter((v) => v != null).length / 6, signalStrength: Math.min(1, Math.abs(gapPct) / 5) }),
    recommendedActions: [
      { title: "残営業日での訪問件数積み増し", description: "今月〜来月の訪問枠を前倒しで確保する。" },
      { title: "新規利用開始の前倒し", description: "契約済み・検討中の利用者の利用開始日を早める。" },
    ],
  };
}

// ============================================================
// DR-03 利用者純減
// ============================================================
export function evaluatePatientNetDecrease(
  stationName: string,
  trend: KpiTrendPoint[],
  t: ThresholdDefaults,
): RuleFinding | null {
  const netChange = series(trend, "net_patient_change");
  const streak = trailingStreak(netChange, (v) => v < 0);
  if (streak < t.min_consecutive_months) return null;

  const newSeries = series(trend, "new_patients");
  const endedSeries = series(trend, "ended_patients");
  const latestNew = newSeries[newSeries.length - 1];
  const latestEnded = endedSeries[endedSeries.length - 1];
  const mainCause = (latestNew ?? 0) < (latestEnded ?? 0) ? "新規利用者の減少" : "終了利用者の増加";

  return {
    ruleCode: "DR-03",
    severity: streak >= t.min_consecutive_months + 1 ? "CRITICAL" : "WARNING",
    title: `${stationName}の利用者数が${streak}ヶ月連続で純減`,
    problemSummary: `${stationName}の利用者純増減が${streak}ヶ月連続でマイナスです。主因は${mainCause}と推定されます。`,
    rootCause: {
      factors: [
        { label: "新規利用者(当月)", kpiCode: "new_patients", value: latestNew ?? null },
        { label: "終了利用者(当月)", kpiCode: "ended_patients", value: latestEnded ?? null },
        { label: "連続マイナス月数", kpiCode: "net_patient_change", value: streak },
      ],
    },
    predictedImpact: null,
    confidence: computeConfidence({ dataCompleteness: 1, signalStrength: Math.min(1, streak / 3) }),
    recommendedActions: [
      { title: "終了理由の分析", description: "PatientEventのendReason内訳を確認し、対応可能な要因を洗い出す。" },
      { title: "営業活動の見直し", description: "新規利用開始を増やすための営業計画を再検討する。" },
    ],
  };
}

// ============================================================
// DR-04 終了者急増
// ============================================================
export function evaluateEndedPatientSurge(
  stationName: string,
  trend: KpiTrendPoint[],
  t: ThresholdDefaults,
): RuleFinding | null {
  const endedSeries = series(trend, "ended_patients");
  const current = endedSeries[endedSeries.length - 1];
  const history = endedSeries.slice(0, -1); // 直近12ヶ月(当月除く)
  const avg = average(history);
  if (current == null || avg == null || avg === 0 || current < t.min_count) return null;

  const ratio = current / avg;
  if (ratio < t.surge_ratio) return null;

  return {
    ruleCode: "DR-04",
    severity: ratio >= 2 ? "CRITICAL" : "WARNING",
    title: `${stationName}の終了利用者が急増(平均比${ratio.toFixed(1)}倍)`,
    problemSummary: `${stationName}の当月終了利用者数(${current}名)は、直近12ヶ月平均(${avg.toFixed(
      1,
    )}名)の${ratio.toFixed(1)}倍に急増しています。`,
    rootCause: {
      factors: [
        { label: "当月終了利用者数", kpiCode: "ended_patients", value: current },
        { label: "直近12ヶ月平均", kpiCode: "ended_patients", value: Math.round(avg * 10) / 10 },
      ],
    },
    predictedImpact: null,
    confidence: computeConfidence({ dataCompleteness: history.filter((v) => v != null).length / 12, signalStrength: Math.min(1, (ratio - 1)) }),
    recommendedActions: [
      { title: "終了理由の内訳確認", description: "入院・死亡・転院・家族都合等の内訳を確認し、偏りがあれば対応する。" },
      { title: "医療連携先へのヒアリング", description: "入院起因が多い場合は連携先医療機関との情報連携を強化する。" },
    ],
  };
}

// ============================================================
// DR-05 新規利用者減少
// ============================================================
export function evaluateNewPatientDecline(
  stationName: string,
  kpis: KpiMap,
  trend: KpiTrendPoint[],
  t: ThresholdDefaults,
): RuleFinding | null {
  const newSeries = series(trend, "new_patients");
  const current = newSeries[newSeries.length - 1];
  const history = newSeries.slice(-4, -1); // 直近3ヶ月(当月除く)
  const avg = average(history);
  if (current == null || avg == null || avg === 0) return null;
  if (current > avg * t.decline_ratio) return null;

  const salesActivity = val(kpis, "sales_activity_count");
  const referralRate = val(kpis, "referral_rate");

  return {
    ruleCode: "DR-05",
    severity: "WARNING",
    title: `${stationName}の新規利用者が減少(直近3ヶ月平均比${((current / avg) * 100).toFixed(0)}%)`,
    problemSummary: `${stationName}の当月新規利用者数(${current}名)は、直近3ヶ月平均(${avg.toFixed(1)}名)を下回っています。`,
    rootCause: {
      factors: [
        { label: "当月新規利用者数", kpiCode: "new_patients", value: current },
        { label: "直近3ヶ月平均", kpiCode: "new_patients", value: Math.round(avg * 10) / 10 },
        ...(salesActivity != null ? [{ label: "営業件数", kpiCode: "sales_activity_count", value: salesActivity }] : []),
        ...(referralRate != null ? [{ label: "紹介率", kpiCode: "referral_rate", value: referralRate }] : []),
      ],
    },
    predictedImpact: null,
    confidence: computeConfidence({ dataCompleteness: history.filter((v) => v != null).length / 3, signalStrength: Math.min(1, 1 - current / avg) }),
    recommendedActions: [
      { title: "営業計画の見直し", description: "営業件数・紹介率の推移を踏まえ、週次営業計画を再設計する。" },
      { title: "優先紹介元リストの活用", description: "紹介実績のある紹介元へのフォローを優先する。" },
    ],
  };
}

// ============================================================
// DR-06 稼働率低下
// ============================================================
export function evaluateUtilizationDrop(stationName: string, kpis: KpiMap, t: ThresholdDefaults): RuleFinding | null {
  const utilizationRate = val(kpis, "utilization_rate");
  if (utilizationRate == null || utilizationRate >= t.utilization_warn_pct) return null;

  const severity: Severity = utilizationRate < t.utilization_critical_pct ? "CRITICAL" : "WARNING";
  const patientCount = val(kpis, "patient_count");
  const visitMinutesPerNurse = val(kpis, "visit_minutes_per_nurse");

  const factors: RootCauseFactor[] = [{ label: "稼働率", kpiCode: "utilization_rate", value: utilizationRate }];
  if (patientCount != null) factors.push({ label: "利用者数", kpiCode: "patient_count", value: patientCount });
  if (visitMinutesPerNurse != null) {
    factors.push({ label: "看護師1人当たり訪問時間", kpiCode: "visit_minutes_per_nurse", value: visitMinutesPerNurse });
  }

  const signalStrength = Math.min(1, (t.utilization_warn_pct - utilizationRate) / t.utilization_warn_pct);

  return {
    ruleCode: "DR-06",
    severity,
    title: `${stationName}の稼働率が${utilizationRate.toFixed(1)}%まで低下`,
    problemSummary: `${stationName}の看護師稼働率が${utilizationRate.toFixed(1)}%まで低下しています。`,
    rootCause: { factors },
    predictedImpact: null,
    confidence: computeConfidence({ dataCompleteness: 1, signalStrength }),
    recommendedActions: [
      { title: "訪問スケジュールの最適化", description: "職員間の訪問配分を見直し、稼働の偏りを解消する。" },
      { title: "利用者増加に向けた営業強化", description: "新規利用開始を増やし稼働率を回復させる。" },
    ],
  };
}

// ============================================================
// DR-07 過稼働
// ============================================================
export function evaluateOverutilization(
  stationName: string,
  kpis: KpiMap,
  workloads: EmployeeWorkload[],
  t: ThresholdDefaults,
): RuleFinding | null {
  const utilizationRate = val(kpis, "utilization_rate");
  const overloaded = workloads.filter((w) => w.workloadIndex != null && w.workloadIndex >= t.workload_index_warn);
  const stationOver = utilizationRate != null && utilizationRate > t.utilization_high_pct;

  if (!stationOver && overloaded.length === 0) return null;

  const severity: Severity =
    (utilizationRate != null && utilizationRate > t.utilization_critical_pct) || overloaded.some((w) => (w.workloadIndex ?? 0) >= 1.5)
      ? "CRITICAL"
      : "WARNING";

  const factors: RootCauseFactor[] = [];
  if (utilizationRate != null) factors.push({ label: "拠点稼働率", kpiCode: "utilization_rate", value: utilizationRate });
  for (const w of overloaded) {
    factors.push({ label: `${w.name}の負荷指数`, kpiCode: "employee_workload_index", value: Math.round((w.workloadIndex ?? 0) * 100) / 100 });
  }

  return {
    ruleCode: "DR-07",
    severity,
    title: stationOver
      ? `${stationName}が過稼働(稼働率${utilizationRate!.toFixed(1)}%)`
      : `${stationName}で特定職員への負荷偏重`,
    problemSummary: stationOver
      ? `${stationName}の稼働率が${utilizationRate!.toFixed(1)}%と高水準です。`
      : `${stationName}で一部職員(${overloaded.map((w) => w.name).join("、")})に訪問業務が偏重しています。`,
    rootCause: { factors },
    predictedImpact: null,
    confidence: computeConfidence({ dataCompleteness: 1, signalStrength: 0.7 }),
    recommendedActions: [
      { title: "業務配分の見直し", description: "訪問スケジュールを再配分し、特定職員への偏重を解消する。" },
      { title: "増員検討", description: "稼働逼迫が継続する場合は採用計画を検討する(DR-15参照)。" },
      { title: "対象職員との面談", description: "負荷の高い職員の状況をヒアリングし、離職リスクを確認する。" },
    ],
  };
}

// ============================================================
// DR-08 人件費率上昇
// ============================================================
export function evaluateLaborCostRatioRise(stationName: string, kpis: KpiMap, t: ThresholdDefaults): RuleFinding | null {
  const laborCostRatio = val(kpis, "labor_cost_ratio");
  if (laborCostRatio == null || laborCostRatio < t.labor_cost_ratio_warn_pct) return null;

  const revenueMoM = val(kpis, "revenue_mom");
  const factors: RootCauseFactor[] = [{ label: "人件費率", kpiCode: "labor_cost_ratio", value: laborCostRatio }];
  if (revenueMoM != null) factors.push({ label: "売上前月比", kpiCode: "revenue_mom", value: revenueMoM });

  return {
    ruleCode: "DR-08",
    severity: laborCostRatio >= t.labor_cost_ratio_critical_pct ? "CRITICAL" : "WARNING",
    title: `${stationName}の人件費率が${laborCostRatio.toFixed(1)}%に上昇`,
    problemSummary: `${stationName}の人件費率が${laborCostRatio.toFixed(1)}%まで上昇しています。`,
    rootCause: { factors },
    predictedImpact: null,
    confidence: computeConfidence({ dataCompleteness: 1, signalStrength: Math.min(1, (laborCostRatio - t.labor_cost_ratio_warn_pct) / 10) }),
    recommendedActions: [
      { title: "稼働率改善による売上増を優先", description: "人員配置を見直す前に、稼働率・新規獲得での改善余地を確認する。" },
      { title: "人員配置の最適化", description: "拠点間の応援体制やシフトの見直しを検討する。" },
    ],
  };
}

// ============================================================
// DR-09 営業利益率低下
// ============================================================
export function evaluateOperatingMarginDecline(
  stationName: string,
  kpis: KpiMap,
  trend: KpiTrendPoint[],
  t: ThresholdDefaults,
): RuleFinding | null {
  const marginSeries = series(trend, "operating_profit_margin");
  const current = marginSeries[marginSeries.length - 1];
  const previous = marginSeries[marginSeries.length - 2];
  if (current == null || previous == null) return null;
  const diff = current - previous;
  if (diff > t.margin_drop_warn_pt) return null;

  const operatingProfit = val(kpis, "operating_profit");
  const isDeficit = operatingProfit != null && operatingProfit < 0;

  return {
    ruleCode: "DR-09",
    severity: isDeficit ? "CRITICAL" : "WARNING",
    title: `${stationName}の営業利益率が${diff.toFixed(1)}pt低下`,
    problemSummary: `${stationName}の営業利益率が前月比${diff.toFixed(1)}pt低下しました${isDeficit ? "(当月赤字)" : ""}。`,
    rootCause: {
      factors: [
        { label: "当月営業利益率", kpiCode: "operating_profit_margin", value: current },
        { label: "前月営業利益率", kpiCode: "operating_profit_margin", value: previous },
      ],
    },
    predictedImpact: operatingProfit,
    confidence: computeConfidence({ dataCompleteness: 1, signalStrength: Math.min(1, Math.abs(diff) / Math.abs(t.margin_drop_warn_pt)) }),
    recommendedActions: [
      { title: "要因分解の確認", description: "売上要因(DR-01)・費用要因(DR-08)のどちらが主因かを確認し、該当Actionを優先する。" },
    ],
  };
}

// ============================================================
// DR-10 営業件数不足
// ============================================================
export function evaluateInsufficientSalesActivity(
  stationName: string,
  trend: KpiTrendPoint[],
  t: ThresholdDefaults,
): RuleFinding | null {
  const activitySeries = series(trend, "sales_activity_count");
  const current = activitySeries[activitySeries.length - 1];
  const history = activitySeries.slice(-4, -1);
  const avg = average(history);
  if (current == null || avg == null || avg === 0) return null;
  if (current > avg * t.activity_ratio_warn) return null;

  return {
    ruleCode: "DR-10",
    severity: "WARNING",
    title: `${stationName}の営業件数が不足(直近3ヶ月平均比${((current / avg) * 100).toFixed(0)}%)`,
    problemSummary: `${stationName}の当月営業件数(${current}件)が、直近3ヶ月平均(${avg.toFixed(1)}件)を大きく下回っています。`,
    rootCause: {
      factors: [
        { label: "当月営業件数", kpiCode: "sales_activity_count", value: current },
        { label: "直近3ヶ月平均", kpiCode: "sales_activity_count", value: Math.round(avg * 10) / 10 },
      ],
    },
    predictedImpact: null,
    confidence: computeConfidence({ dataCompleteness: history.filter((v) => v != null).length / 3, signalStrength: Math.min(1, 1 - current / avg) }),
    recommendedActions: [
      { title: "週次営業計画の見直し", description: "営業担当別の活動件数を確認し、計画を再設計する。" },
      { title: "優先紹介元リストの提示", description: "訪問優先度の高い紹介元をリスト化して配布する。" },
    ],
  };
}

// ============================================================
// DR-11 営業紹介率低下
// ============================================================
export function evaluateReferralRateDecline(
  stationName: string,
  trend: KpiTrendPoint[],
  t: ThresholdDefaults,
): RuleFinding | null {
  const rateSeries = series(trend, "referral_rate");
  const current = rateSeries[rateSeries.length - 1];
  const history = rateSeries.slice(-4, -1);
  const avg = average(history);
  if (current == null || avg == null || avg === 0) return null;
  if (current > avg * t.referral_rate_ratio_warn) return null;

  return {
    ruleCode: "DR-11",
    severity: "WARNING",
    title: `${stationName}の営業紹介率が低下`,
    problemSummary: `${stationName}の当月紹介率(${current.toFixed(1)}%)が、直近3ヶ月平均(${avg.toFixed(1)}%)を下回っています。`,
    rootCause: {
      factors: [
        { label: "当月紹介率", kpiCode: "referral_rate", value: current },
        { label: "直近3ヶ月平均紹介率", kpiCode: "referral_rate", value: Math.round(avg * 10) / 10 },
      ],
    },
    predictedImpact: null,
    confidence: computeConfidence({ dataCompleteness: history.filter((v) => v != null).length / 3, signalStrength: Math.min(1, 1 - current / avg) }),
    recommendedActions: [
      { title: "紹介元別の変化を確認", description: "特定紹介元の変化か全体傾向かを切り分ける(DR-12もあわせて確認)。" },
      { title: "営業トークの見直し", description: "紹介依頼の伝え方・タイミングを見直す。" },
    ],
  };
}

// ============================================================
// DR-12 重要紹介元休眠
// ============================================================
export function evaluateKeyReferralSourceDormant(
  stationName: string,
  sources: ReferralSourceDetail[],
  t: ThresholdDefaults,
): RuleFinding | null {
  const dormantTopSources = sources.filter(
    (s) => s.isTopContributor && s.dormancyDays != null && s.dormancyDays >= t.dormancy_warn_days,
  );
  if (dormantTopSources.length === 0) return null;

  const worst = dormantTopSources.reduce((a, b) => ((a.dormancyDays ?? 0) > (b.dormancyDays ?? 0) ? a : b));
  const severity: Severity =
    worst.contributionRank <= Math.ceil(sources.length * 0.1) && (worst.dormancyDays ?? 0) >= t.dormancy_critical_days
      ? "CRITICAL"
      : "WARNING";

  return {
    ruleCode: "DR-12",
    severity,
    title: `${stationName}の重要紹介元「${worst.name}」が${worst.dormancyDays}日間休眠`,
    problemSummary: `${stationName}の紹介貢献度上位の紹介元「${worst.name}」への最終接触から${worst.dormancyDays}日が経過しています。`,
    rootCause: {
      factors: [
        { label: "休眠日数", kpiCode: "referral_source_dormancy_days", value: worst.dormancyDays },
        { label: "過去12ヶ月の紹介貢献(件数)", kpiCode: "referral_source_dormancy_days", value: worst.trailing12moContribution },
      ],
    },
    predictedImpact: null,
    confidence: computeConfidence({ dataCompleteness: 1, signalStrength: Math.min(1, (worst.dormancyDays ?? 0) / t.dormancy_critical_days) }),
    recommendedActions: [
      { title: `${worst.name}への優先再訪`, description: "担当営業を割り当て、早期に再訪問を実施する。" },
    ],
  };
}

// ============================================================
// DR-13 看護師不足
// ============================================================
export function evaluateNurseShortage(
  stationName: string,
  kpis: KpiMap,
  trend: KpiTrendPoint[],
  t: ThresholdDefaults,
): RuleFinding | null {
  const nurseCount = val(kpis, "nurse_count");
  const visitMinutesSeries = series(trend, "total_visit_minutes");
  const forecastMinutes = forecastLinear(visitMinutesSeries.slice(-6), 3); // 3ヶ月後の訪問時間需要を予測
  if (nurseCount == null || forecastMinutes == null) return null;

  const STANDARD_VISIT_MINUTES_PER_MONTH = 360 * 20; // 06.7節の仮定値と揃える
  const requiredNurses = Math.ceil(forecastMinutes / STANDARD_VISIT_MINUTES_PER_MONTH);
  const shortage = requiredNurses - nurseCount;
  if (shortage < t.shortage_warn_count) return null;

  return {
    ruleCode: "DR-13",
    severity: shortage >= t.shortage_critical_count ? "CRITICAL" : "WARNING",
    title: `${stationName}で3ヶ月後に看護師${shortage}名の不足見込み`,
    problemSummary: `${stationName}は訪問需要のトレンドから3ヶ月後に${requiredNurses}名の看護師が必要と予測され、現員(${nurseCount}名)に対し${shortage}名不足する見込みです。`,
    rootCause: {
      factors: [
        { label: "現在の看護師数", kpiCode: "nurse_count", value: nurseCount },
        { label: "3ヶ月後の必要看護師数(予測)", kpiCode: "nurse_count", value: requiredNurses },
      ],
    },
    predictedImpact: null,
    confidence: computeConfidence({ dataCompleteness: visitMinutesSeries.filter((v) => v != null).length / 6, signalStrength: Math.min(1, shortage / 2) }),
    recommendedActions: [
      { title: "採用計画の立案", description: `${stationName}向けに看護師${shortage}名の採用を計画する。`, approvalCategory: "HIRING" },
    ],
  };
}

// ============================================================
// DR-14 看護師過剰
// ============================================================
export function evaluateNurseSurplus(stationName: string, trend: KpiTrendPoint[], t: ThresholdDefaults): RuleFinding | null {
  const utilSeries = series(trend, "utilization_rate");
  const streak = trailingStreak(utilSeries, (v) => v < t.utilization_low_pct);
  if (streak < t.min_consecutive_months) return null;

  const current = utilSeries[utilSeries.length - 1];
  return {
    ruleCode: "DR-14",
    severity: "WARNING",
    title: `${stationName}の稼働率が${streak}ヶ月連続で低水準`,
    problemSummary: `${stationName}の稼働率が${streak}ヶ月連続で${t.utilization_low_pct}%を下回っています(当月${current?.toFixed(1)}%)。`,
    rootCause: { factors: [{ label: "連続低稼働月数", kpiCode: "utilization_rate", value: streak }] },
    predictedImpact: null,
    confidence: computeConfidence({ dataCompleteness: 1, signalStrength: Math.min(1, streak / t.min_consecutive_months) }),
    recommendedActions: [
      { title: "新規採用の停止", description: "進行中の採用があれば一時保留を検討する(DR-16参照)。", approvalCategory: "HIRING" },
      { title: "営業強化による稼働率改善", description: "利用者増加に向けた営業活動を優先する。" },
    ],
  };
}

// ============================================================
// DR-15 採用必要性
// ============================================================
export function evaluateHiringNeed(
  stationName: string,
  kpis: KpiMap,
  shortageFinding: RuleFinding | null,
): RuleFinding | null {
  const turnoverRate = val(kpis, "turnover_rate");
  const highTurnover = turnoverRate != null && turnoverRate >= 8;

  if (!shortageFinding && !highTurnover) return null;

  const factors: RootCauseFactor[] = [];
  if (shortageFinding) factors.push(...shortageFinding.rootCause.factors);
  if (turnoverRate != null) factors.push({ label: "離職率", kpiCode: "turnover_rate", value: turnoverRate });

  return {
    ruleCode: "DR-15",
    severity: shortageFinding?.severity ?? "WARNING",
    title: `${stationName}の採用が必要`,
    problemSummary: `${stationName}は${shortageFinding ? "需要側(利用者増予測)" : ""}${
      shortageFinding && highTurnover ? "・" : ""
    }${highTurnover ? "供給側(離職率上昇)" : ""}の両面から採用計画の検討が必要です。`,
    rootCause: { factors },
    predictedImpact: null,
    confidence: computeConfidence({ dataCompleteness: 1, signalStrength: shortageFinding ? 0.8 : 0.5 }),
    recommendedActions: [
      { title: "採用計画(人数・職種・拠点・時期)の提示", description: "需給ギャップを踏まえた採用計画を立案する。", approvalCategory: "HIRING" },
    ],
  };
}

// ============================================================
// DR-16 採用停止
// ============================================================
export function evaluateHiringFreeze(
  stationName: string,
  kpis: KpiMap,
  hasOpenRecruitment: boolean,
  t: ThresholdDefaults,
): RuleFinding | null {
  if (!hasOpenRecruitment) return null;
  const utilizationRate = val(kpis, "utilization_rate");
  const laborCostRatio = val(kpis, "labor_cost_ratio");

  const lowUtilization = utilizationRate != null && utilizationRate < t.utilization_low_pct;
  const highLaborCost = laborCostRatio != null && laborCostRatio >= 60;
  if (!lowUtilization && !highLaborCost) return null;

  return {
    ruleCode: "DR-16",
    severity: "WARNING",
    title: `${stationName}で進行中の採用の一時保留を検討`,
    problemSummary: `${stationName}は${lowUtilization ? "稼働率低下" : ""}${
      lowUtilization && highLaborCost ? "・" : ""
    }${highLaborCost ? "人件費率上昇" : ""}が見られ、進行中の採用の一時保留を検討すべき状況です。`,
    rootCause: {
      factors: [
        ...(utilizationRate != null ? [{ label: "稼働率", kpiCode: "utilization_rate", value: utilizationRate }] : []),
        ...(laborCostRatio != null ? [{ label: "人件費率", kpiCode: "labor_cost_ratio", value: laborCostRatio }] : []),
      ],
    },
    predictedImpact: null,
    confidence: computeConfidence({ dataCompleteness: 1, signalStrength: 0.6 }),
    recommendedActions: [
      { title: "進行中採用の一時保留", description: "進行中のRecruitmentRecordを一時保留し、状況を再評価する。", approvalCategory: "HIRING" },
    ],
  };
}

// ============================================================
// DR-17 Cash Runway低下（法人全体のみ評価）
// ============================================================
export function evaluateCashRunway(kpis: KpiMap, t: ThresholdDefaults): RuleFinding | null {
  const runway = val(kpis, "cash_runway_months");
  if (runway == null || !Number.isFinite(runway) || runway >= t.cash_runway_warn_months) return null;

  const severity: Severity = runway < t.cash_runway_critical_months ? "CRITICAL" : "WARNING";
  const cashBalance = val(kpis, "cash_balance");
  const netBurn = val(kpis, "monthly_net_burn");

  const factors: RootCauseFactor[] = [{ label: "Cash Runway", kpiCode: "cash_runway_months", value: runway }];
  if (cashBalance != null) factors.push({ label: "現預金", kpiCode: "cash_balance", value: cashBalance });
  if (netBurn != null) factors.push({ label: "月次Burn Rate", kpiCode: "monthly_net_burn", value: netBurn });

  const signalStrength = Math.min(1, (t.cash_runway_warn_months - runway) / t.cash_runway_warn_months);

  return {
    ruleCode: "DR-17",
    severity,
    title: `法人全体のCash Runwayが${runway.toFixed(1)}ヶ月に低下`,
    problemSummary: `法人全体のCash Runwayが${runway.toFixed(1)}ヶ月まで低下しています。`,
    rootCause: { factors },
    predictedImpact: cashBalance,
    confidence: computeConfidence({ dataCompleteness: cashBalance != null && netBurn != null ? 1 : 0.5, signalStrength }),
    recommendedActions: [
      { title: "コスト削減案の検討", description: "固定費・変動費の見直しにより月次Burnを抑制する。" },
      { title: "資金調達(借入)の検討", description: "運転資金の借入を含めた資金計画を経営会議で検討する。", approvalCategory: "LOAN" },
    ],
  };
}

// ============================================================
// DR-18 拠点赤字
// ============================================================
export function evaluateStationDeficit(stationName: string, trend: KpiTrendPoint[], t: ThresholdDefaults): RuleFinding | null {
  const profitSeries = series(trend, "station_operating_profit");
  const streak = trailingStreak(profitSeries, (v) => v < 0);
  if (streak < t.min_consecutive_months) return null;

  const current = profitSeries[profitSeries.length - 1];
  return {
    ruleCode: "DR-18",
    severity: streak >= t.critical_consecutive_months ? "CRITICAL" : "WARNING",
    title: `${stationName}が${streak}ヶ月連続赤字`,
    problemSummary: `${stationName}の営業利益が${streak}ヶ月連続でマイナスです(当月${current?.toLocaleString("ja-JP")}円)。`,
    rootCause: { factors: [{ label: "連続赤字月数", kpiCode: "station_operating_profit", value: streak }] },
    predictedImpact: current,
    confidence: computeConfidence({ dataCompleteness: 1, signalStrength: Math.min(1, streak / t.critical_consecutive_months) }),
    recommendedActions: [
      { title: "拠点特化の改善計画", description: "DR-01/DR-06/DR-08系のActionを束ねて改善計画を策定する。" },
    ],
  };
}

// ============================================================
// DR-19 出店可能性（法人全体、機会提示）
// ============================================================
export function evaluateNewStationOpportunity(
  companyKpis: KpiMap,
  averageUtilization: number | null,
  t: ThresholdDefaults,
): RuleFinding | null {
  const runway = val(companyKpis, "cash_runway_months");
  const margin = val(companyKpis, "operating_profit_margin");
  if (runway == null || !Number.isFinite(runway) || runway < t.cash_runway_min_months) return null;
  if (margin == null || margin < t.operating_margin_min_pct) return null;
  if (averageUtilization == null || averageUtilization < t.utilization_min_pct) return null;

  return {
    ruleCode: "DR-19",
    severity: "INFO",
    title: "新規出店の検討余地があります",
    problemSummary: `財務余力(Runway${runway.toFixed(1)}ヶ月、営業利益率${margin.toFixed(
      1,
    )}%)と既存拠点の需給逼迫(平均稼働率${averageUtilization.toFixed(1)}%)から、新規出店の機会があります。`,
    rootCause: {
      factors: [
        { label: "Cash Runway", kpiCode: "cash_runway_months", value: runway },
        { label: "営業利益率", kpiCode: "operating_profit_margin", value: margin },
        { label: "既存拠点平均稼働率", kpiCode: "utilization_rate", value: averageUtilization },
      ],
    },
    predictedImpact: null,
    confidence: computeConfidence({ dataCompleteness: 1, signalStrength: 0.6, historicalPrior: 0.5 }),
    recommendedActions: [
      { title: "Scenario Simulatorでの出店シミュレーション", description: "新規出店の財務影響を試算する(Phase3実装)。", approvalCategory: "NEW_STATION" },
    ],
  };
}

// ============================================================
// DR-20 撤退検討
// ============================================================
export function evaluateWithdrawalConsideration(
  stationName: string,
  trend: KpiTrendPoint[],
  t: ThresholdDefaults,
): RuleFinding | null {
  const profitSeries = series(trend, "station_operating_profit");
  const streak = trailingStreak(profitSeries, (v) => v < 0);
  if (streak < t.min_consecutive_months) return null;

  const current = profitSeries[profitSeries.length - 1];
  return {
    ruleCode: "DR-20",
    severity: "CRITICAL",
    title: `${stationName}の撤退検討が必要な水準`,
    problemSummary: `${stationName}は${streak}ヶ月連続で赤字が継続しており、改善Actionの効果が確認できない場合は撤退・縮小・統合の検討が必要です。`,
    rootCause: { factors: [{ label: "連続赤字月数", kpiCode: "station_operating_profit", value: streak }] },
    predictedImpact: current,
    confidence: computeConfidence({ dataCompleteness: 1, signalStrength: Math.min(1, streak / t.min_consecutive_months), historicalPrior: 0.5 }),
    recommendedActions: [
      {
        title: "撤退/縮小/統合の選択肢を財務影響とともに提示",
        description: "経営会議での議題化を前提に、各選択肢の財務影響を整理する。",
        approvalCategory: "WITHDRAWAL",
      },
    ],
  };
}
