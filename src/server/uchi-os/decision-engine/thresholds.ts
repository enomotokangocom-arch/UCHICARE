// 07章冒頭:「閾値をハードコードしすぎない。企業・拠点ごとに変更可能な設計にする」の実装。
// 各ルールはここで解決したパラメータを使う。優先順位: 拠点別上書き > 組織全体の既定値上書き > ハードコードのデフォルト。

import { prisma } from "@/server/uchi-os/db/client";

export type ThresholdDefaults = Record<string, number>;

/** ルールごとのデフォルト閾値 (07章の各ルール定義の default値)。 */
export const RULE_THRESHOLD_DEFAULTS: Record<string, ThresholdDefaults> = {
  "DR-01": { revenue_drop_warn_pct: -5, revenue_drop_critical_pct: -10 },
  "DR-02": { forecast_gap_warn_pct: -5 },
  "DR-03": { min_consecutive_months: 2 },
  "DR-04": { surge_ratio: 1.5, min_count: 3 },
  "DR-05": { decline_ratio: 0.7 },
  "DR-06": { utilization_warn_pct: 75, utilization_critical_pct: 65 },
  "DR-07": { utilization_high_pct: 90, utilization_critical_pct: 95, workload_index_warn: 1.3 },
  "DR-08": { labor_cost_ratio_warn_pct: 60, labor_cost_ratio_critical_pct: 65 },
  "DR-09": { margin_drop_warn_pt: -3 },
  "DR-10": { activity_ratio_warn: 0.6 },
  "DR-11": { referral_rate_ratio_warn: 0.7 },
  "DR-12": { dormancy_warn_days: 90, dormancy_critical_days: 120, top_contribution_pct: 20 },
  "DR-13": { shortage_warn_count: 1, shortage_critical_count: 2 },
  "DR-14": { utilization_low_pct: 60, min_consecutive_months: 3 },
  "DR-16": { utilization_low_pct: 60 },
  "DR-17": { cash_runway_warn_months: 6, cash_runway_critical_months: 3 },
  "DR-18": { min_consecutive_months: 2, critical_consecutive_months: 3 },
  "DR-19": { cash_runway_min_months: 12, operating_margin_min_pct: 10, utilization_min_pct: 80 },
  "DR-20": { min_consecutive_months: 6 },
};

/**
 * ルールの閾値パラメータを解決する。
 * `stationId` が指定されている場合、その拠点向けの上書き値を最優先で使う。
 */
export async function resolveThresholds(
  organizationId: string,
  stationId: string | null,
  ruleCode: string,
): Promise<ThresholdDefaults> {
  const defaults = RULE_THRESHOLD_DEFAULTS[ruleCode] ?? {};
  const rows = await prisma.anomalyThreshold.findMany({
    where: {
      organizationId,
      ruleCode,
      OR: [{ stationId: null }, ...(stationId ? [{ stationId }] : [])],
    },
  });

  const resolved = { ...defaults };
  // 組織全体の上書きを先に適用し、拠点別の上書きで最終的に上書きする。
  for (const row of rows.filter((r) => r.stationId === null)) {
    resolved[row.paramKey] = Number(row.paramValue);
  }
  for (const row of rows.filter((r) => r.stationId === stationId && stationId !== null)) {
    resolved[row.paramKey] = Number(row.paramValue);
  }
  return resolved;
}

/** 複数ルールの閾値を一括解決する(ルールコード -> 解決済みパラメータ)。 */
export async function resolveThresholdsForRules(
  organizationId: string,
  stationId: string | null,
  ruleCodes: string[],
): Promise<Record<string, ThresholdDefaults>> {
  const entries = await Promise.all(
    ruleCodes.map(async (ruleCode) => [ruleCode, await resolveThresholds(organizationId, stationId, ruleCode)] as const),
  );
  return Object.fromEntries(entries);
}
