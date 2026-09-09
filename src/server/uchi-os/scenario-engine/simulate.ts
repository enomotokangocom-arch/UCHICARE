import { prisma } from "@/server/uchi-os/db/client";
import { computeMonthlyKpis } from "@/server/uchi-os/kpi-engine/compute";
import { getFinancialInputs } from "@/server/uchi-os/kpi-engine/aggregate";
import { computeStationForecast } from "@/server/uchi-os/forecast-engine/forecast";
import { applyScenario, baselineProjection } from "./calculate";
import type { ScenarioBaseline, ScenarioComparison, ScenarioParamsByType, ScenarioProjection, ScenarioType } from "./types";

const FALLBACK_AVG_SALARY = 400_000;

async function getAverageNurseSalary(organizationId: string, stationId: string | null): Promise<number> {
  const nurses = await prisma.employee.findMany({
    where: {
      organizationId,
      employeeType: "NURSE",
      resignedAt: null,
      ...(stationId ? { stationId } : {}),
    },
    select: { monthlySalaryCost: true },
  });
  if (nurses.length === 0) return FALLBACK_AVG_SALARY;
  const total = nurses.reduce((sum, n) => sum + Number(n.monthlySalaryCost), 0);
  return total / nurses.length;
}

/**
 * シナリオの起点となるベースライン(3ヶ月後の「何もしない場合」の予測)を組み立てる。
 * Forecast Engineの3ヶ月後予測を土台にし、看護師数・稼働率など「現時点の構造」は
 * 現在値をそのまま使う(採用・退職等のシナリオは構造そのものへの変更のため)。
 */
export async function buildScenarioBaseline(
  organizationId: string,
  stationId: string | null,
  yearMonth: string,
): Promise<ScenarioBaseline> {
  const [kpiEntries, forecast, financial, avgSalaryPerNurse] = await Promise.all([
    computeMonthlyKpis(organizationId, stationId, yearMonth),
    computeStationForecast(organizationId, stationId, yearMonth),
    getFinancialInputs(organizationId, stationId, yearMonth),
    getAverageNurseSalary(organizationId, stationId),
  ]);

  const kpis = new Map(kpiEntries.map((e) => [e.kpiCode, e]));
  const get = (code: string) => {
    const entry = kpis.get(code);
    return entry && !entry.insufficientData ? entry.value : null;
  };

  const currentRevenue = get("monthly_revenue");
  const currentPatientCount = get("patient_count");
  const revenuePerPatient =
    currentRevenue != null && currentPatientCount != null && currentPatientCount > 0
      ? currentRevenue / currentPatientCount
      : null;

  return {
    revenue3mo: forecast.revenue.threeMonths?.value ?? currentRevenue,
    laborCost3mo: forecast.laborCost.threeMonths?.value ?? get("labor_cost"),
    patientCount3mo: forecast.patientCount.threeMonths?.value ?? currentPatientCount,
    otherCosts: (financial.otherFixedCost ?? 0) + (financial.otherVariableCost ?? 0),
    nurseCount: get("nurse_count"),
    utilizationRate: get("utilization_rate"),
    avgSalaryPerNurse,
    revenuePerPatient,
  };
}

function diff(a: number | null, b: number | null): number | null {
  return a != null && b != null ? a - b : null;
}

export async function runScenario<T extends ScenarioType>(
  organizationId: string,
  stationId: string | null,
  yearMonth: string,
  type: T,
  params: ScenarioParamsByType[T],
): Promise<ScenarioComparison> {
  const baseline = await buildScenarioBaseline(organizationId, stationId, yearMonth);
  const baselineResult = baselineProjection(baseline);
  const withScenario = applyScenario(type, params, baseline);

  const delta: ScenarioProjection = {
    revenue: diff(withScenario.revenue, baselineResult.revenue),
    laborCost: diff(withScenario.laborCost, baselineResult.laborCost),
    operatingProfit: diff(withScenario.operatingProfit, baselineResult.operatingProfit),
    operatingProfitMargin: diff(withScenario.operatingProfitMargin, baselineResult.operatingProfitMargin),
    utilizationRate: diff(withScenario.utilizationRate, baselineResult.utilizationRate),
    patientCount: diff(withScenario.patientCount, baselineResult.patientCount),
    nurseCount: diff(withScenario.nurseCount, baselineResult.nurseCount),
  };

  return { baseline: baselineResult, withScenario, delta };
}
