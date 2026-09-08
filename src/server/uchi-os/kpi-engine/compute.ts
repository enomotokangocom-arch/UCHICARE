// KPI Engine — Calculation Engineの出力を、KPISnapshotとして保存可能な形に正規化する (04章)。

import type { KPIValueType } from "@prisma/client";
import * as formulas from "@/server/uchi-os/calculation-engine/formulas";
import { ok, insufficient, type KpiResult } from "@/server/uchi-os/calculation-engine/types";
import {
  getFinancialInputs,
  getPatientInputs,
  getVisitInputs,
  getWorkforceInputs,
  getSalesInputs,
} from "./aggregate";
import { shiftYearMonth } from "./dates";

// 1FTEあたりの標準訪問可能時間の仮定値 (稼働率計算の分母)。
// ハードコードを避けるべき対象だが、Phase1では組織別設定が未実装のため定数とする。
// Phase2で AnomalyThreshold と同様に組織/拠点別の Settings 値へ移行する想定 (06章・07章冒頭の方針)。
const STANDARD_VISIT_MINUTES_PER_DAY = 360;
const STANDARD_WORKING_DAYS_PER_MONTH = 20;

export interface KpiEntry {
  kpiCode: string;
  value: number | null;
  insufficientData: boolean;
  valueType: KPIValueType;
}

function entry(kpiCode: string, result: KpiResult, valueType: KPIValueType): KpiEntry {
  return { kpiCode, value: result.value, insufficientData: result.insufficientData, valueType };
}

/**
 * 指定した組織・拠点（nullなら法人全体）・年月のKPIを一括計算する。
 * DBアクセス(aggregate.ts)とCalculation Engine(純粋関数)を橋渡しする層。
 */
export async function computeMonthlyKpis(
  organizationId: string,
  stationId: string | null,
  yearMonth: string,
): Promise<KpiEntry[]> {
  const previousMonth = shiftYearMonth(yearMonth, -1);
  const previousYearMonth = shiftYearMonth(yearMonth, -12);

  const [financial, prevFinancial, prevYearFinancial, patients, visits, workforce, sales] = await Promise.all([
    getFinancialInputs(organizationId, stationId, yearMonth),
    getFinancialInputs(organizationId, stationId, previousMonth),
    getFinancialInputs(organizationId, stationId, previousYearMonth),
    getPatientInputs(organizationId, stationId, yearMonth),
    getVisitInputs(organizationId, stationId, yearMonth),
    getWorkforceInputs(organizationId, stationId, yearMonth),
    getSalesInputs(organizationId, stationId, yearMonth),
  ]);

  const entries: KpiEntry[] = [];

  // 売上系
  entries.push(entry("monthly_revenue", financial.revenue != null ? ok(financial.revenue) : insufficient, "FACT"));
  entries.push(entry("revenue_mom", formulas.revenueMoM(financial.revenue, prevFinancial.revenue), "CALCULATED"));
  entries.push(entry("revenue_yoy", formulas.revenueYoY(financial.revenue, prevYearFinancial.revenue), "CALCULATED"));
  entries.push(entry("revenue_per_nurse", formulas.revenuePerNurse(financial.revenue, workforce.nurseFte), "CALCULATED"));

  // 利用者系
  entries.push(entry("patient_count", ok(patients.activeAtMonthEnd), "FACT"));
  entries.push(entry("new_patients", ok(patients.newPatients), "FACT"));
  entries.push(entry("ended_patients", ok(patients.endedPatients), "FACT"));
  entries.push(entry("net_patient_change", formulas.netPatientChange(patients.newPatients, patients.endedPatients), "CALCULATED"));

  // 訪問系
  entries.push(entry("total_visits", ok(visits.totalVisits), "FACT"));
  entries.push(entry("total_visit_minutes", ok(visits.totalVisitMinutes), "FACT"));
  const standardAvailableMinutes =
    workforce.nurseFte > 0 ? workforce.nurseFte * STANDARD_VISIT_MINUTES_PER_DAY * STANDARD_WORKING_DAYS_PER_MONTH : null;
  entries.push(entry("utilization_rate", formulas.utilizationRate(visits.totalVisitMinutes, standardAvailableMinutes), "CALCULATED"));
  entries.push(entry("visit_minutes_per_nurse", formulas.visitMinutesPerNurse(visits.totalVisitMinutes, workforce.nurseFte), "CALCULATED"));

  // 人員系
  entries.push(entry("nurse_count", ok(workforce.nurseCount), "FACT"));
  entries.push(entry("therapist_count", ok(workforce.therapistCount), "FACT"));
  entries.push(entry("office_staff_count", ok(workforce.officeStaffCount), "FACT"));
  entries.push(entry("total_fte", ok(workforce.totalFte), "CALCULATED"));
  entries.push(entry("hires_count", ok(workforce.hiresCount), "FACT"));
  entries.push(entry("resignations_count", ok(workforce.resignationsCount), "FACT"));
  entries.push(
    entry("turnover_rate", formulas.turnoverRate(workforce.resignationsCount, workforce.headcountAtMonthStart), "CALCULATED"),
  );

  // 財務系
  entries.push(entry("revenue", financial.revenue != null ? ok(financial.revenue) : insufficient, "FACT"));
  entries.push(entry("labor_cost", financial.laborCost != null ? ok(financial.laborCost) : insufficient, "FACT"));
  entries.push(entry("labor_cost_ratio", formulas.laborCostRatio(financial.laborCost, financial.revenue), "CALCULATED"));
  const opProfit = formulas.operatingProfit(
    financial.revenue,
    financial.laborCost,
    financial.otherFixedCost,
    financial.otherVariableCost,
  );
  entries.push(entry("operating_profit", opProfit, "CALCULATED"));
  entries.push(entry("operating_profit_margin", formulas.operatingProfitMargin(opProfit.value, financial.revenue), "CALCULATED"));
  entries.push(entry("ebitda", formulas.ebitda(opProfit.value), "CALCULATED"));
  if (stationId === null) {
    const totalExpense =
      financial.laborCost != null
        ? financial.laborCost + (financial.otherFixedCost ?? 0) + (financial.otherVariableCost ?? 0)
        : null;
    const netBurn = formulas.monthlyNetBurn(totalExpense, financial.revenue);
    entries.push(entry("monthly_net_burn", netBurn, "CALCULATED"));
    entries.push(entry("cash_balance", financial.cashBalance != null ? ok(financial.cashBalance) : insufficient, "FACT"));
    entries.push(entry("cash_runway_months", formulas.cashRunwayMonths(financial.cashBalance, netBurn.value), "CALCULATED"));
  }

  // 拠点別営業利益 (06.7節、拠点スコープのみ)
  if (stationId !== null) {
    entries.push(
      entry(
        "station_operating_profit",
        formulas.stationOperatingProfit(financial.revenue, financial.laborCost, financial.otherFixedCost),
        "CALCULATED",
      ),
    );
  }

  // 営業系
  entries.push(entry("sales_activity_count", ok(sales.salesActivityCount), "FACT"));
  entries.push(entry("active_referral_sources", ok(sales.activeReferralSourceCount), "FACT"));
  entries.push(entry("referral_count", ok(sales.referralCount), "FACT"));
  entries.push(entry("referral_rate", formulas.referralRate(sales.referralCount, sales.salesActivityCount), "CALCULATED"));

  return entries;
}
