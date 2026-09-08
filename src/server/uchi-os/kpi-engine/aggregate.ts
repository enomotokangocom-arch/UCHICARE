// KPI Engine — raw data aggregation. DBから月次の生数値を取得するだけの層。
// 計算式は一切ここに書かない（Calculation Engineに委譲、04章のレイヤー分離）。

import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/uchi-os/db/client";
import { monthRange } from "./dates";

function toNum(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === "number" ? value : value.toNumber();
}

/** stationId が null の場合は組織全体（全拠点合算）を意味する。 */
function stationFilter(stationId: string | null) {
  return stationId ? { stationId } : {};
}

export interface FinancialInputs {
  revenue: number | null;
  laborCost: number | null;
  otherFixedCost: number | null;
  otherVariableCost: number | null;
  cashBalance: number | null; // 組織全体(HQ行)にのみ記録される
}

export async function getFinancialInputs(
  organizationId: string,
  stationId: string | null,
  yearMonth: string,
): Promise<FinancialInputs> {
  if (stationId) {
    const record = await prisma.financialRecord.findUnique({
      where: { organizationId_stationId_yearMonth: { organizationId, stationId, yearMonth } },
    });
    return {
      revenue: toNum(record?.revenue),
      laborCost: toNum(record?.laborCost),
      otherFixedCost: toNum(record?.otherFixedCost) ?? 0,
      otherVariableCost: toNum(record?.otherVariableCost) ?? 0,
      cashBalance: null,
    };
  }

  // 組織全体 = 全拠点のFinancialRecord合算 + HQ行(stationId=null、本部費用・現預金)
  const records = await prisma.financialRecord.findMany({
    where: { organizationId, yearMonth },
  });
  if (records.length === 0) {
    return { revenue: null, laborCost: null, otherFixedCost: null, otherVariableCost: null, cashBalance: null };
  }
  const hqRecord = records.find((r) => r.stationId === null);
  return {
    revenue: records.reduce((sum, r) => sum + (toNum(r.revenue) ?? 0), 0),
    laborCost: records.reduce((sum, r) => sum + (toNum(r.laborCost) ?? 0), 0),
    otherFixedCost: records.reduce((sum, r) => sum + (toNum(r.otherFixedCost) ?? 0), 0),
    otherVariableCost: records.reduce((sum, r) => sum + (toNum(r.otherVariableCost) ?? 0), 0),
    cashBalance: toNum(hqRecord?.cashBalance),
  };
}

export interface PatientInputs {
  activeAtMonthEnd: number;
  newPatients: number;
  endedPatients: number;
}

export async function getPatientInputs(
  organizationId: string,
  stationId: string | null,
  yearMonth: string,
): Promise<PatientInputs> {
  const { start, end } = monthRange(yearMonth);
  const scope = { organizationId, ...stationFilter(stationId) };

  const [activeAtMonthEnd, newPatients, endedPatients] = await Promise.all([
    prisma.patient.count({
      where: { ...scope, startedAt: { lt: end }, OR: [{ endedAt: null }, { endedAt: { gte: end } }] },
    }),
    prisma.patient.count({ where: { ...scope, startedAt: { gte: start, lt: end } } }),
    prisma.patient.count({ where: { ...scope, endedAt: { gte: start, lt: end } } }),
  ]);

  return { activeAtMonthEnd, newPatients, endedPatients };
}

export interface VisitInputs {
  totalVisits: number;
  totalVisitMinutes: number;
}

export async function getVisitInputs(
  organizationId: string,
  stationId: string | null,
  yearMonth: string,
): Promise<VisitInputs> {
  const { start, end } = monthRange(yearMonth);
  const aggregate = await prisma.visit.aggregate({
    where: { organizationId, ...stationFilter(stationId), visitedAt: { gte: start, lt: end } },
    _count: { _all: true },
    _sum: { durationMinutes: true },
  });
  return {
    totalVisits: aggregate._count._all,
    totalVisitMinutes: aggregate._sum.durationMinutes ?? 0,
  };
}

export interface WorkforceInputs {
  nurseCount: number;
  therapistCount: number;
  officeStaffCount: number;
  totalFte: number;
  nurseFte: number;
  hiresCount: number;
  resignationsCount: number;
  headcountAtMonthStart: number;
}

export async function getWorkforceInputs(
  organizationId: string,
  stationId: string | null,
  yearMonth: string,
): Promise<WorkforceInputs> {
  const { start, end } = monthRange(yearMonth);
  const scope = { organizationId, ...stationFilter(stationId) };

  const activeAtMonthEnd = await prisma.employee.findMany({
    where: { ...scope, hiredAt: { lt: end }, OR: [{ resignedAt: null }, { resignedAt: { gte: end } }] },
    select: { employeeType: true, fte: true },
  });

  const [hiresCount, resignationsCount, headcountAtMonthStart] = await Promise.all([
    prisma.employee.count({ where: { ...scope, hiredAt: { gte: start, lt: end } } }),
    prisma.employee.count({ where: { ...scope, resignedAt: { gte: start, lt: end } } }),
    prisma.employee.count({
      where: { ...scope, hiredAt: { lt: start }, OR: [{ resignedAt: null }, { resignedAt: { gte: start } }] },
    }),
  ]);

  return {
    nurseCount: activeAtMonthEnd.filter((e) => e.employeeType === "NURSE").length,
    therapistCount: activeAtMonthEnd.filter((e) => e.employeeType === "THERAPIST").length,
    officeStaffCount: activeAtMonthEnd.filter((e) => e.employeeType === "OFFICE").length,
    totalFte: activeAtMonthEnd.reduce((sum, e) => sum + e.fte, 0),
    nurseFte: activeAtMonthEnd.filter((e) => e.employeeType === "NURSE").reduce((sum, e) => sum + e.fte, 0),
    hiresCount,
    resignationsCount,
    headcountAtMonthStart,
  };
}

export interface SalesInputs {
  salesActivityCount: number;
  activeReferralSourceCount: number;
  referralCount: number;
}

export async function getSalesInputs(
  organizationId: string,
  stationId: string | null,
  yearMonth: string,
): Promise<SalesInputs> {
  const { start, end } = monthRange(yearMonth);
  const scope = { organizationId, ...stationFilter(stationId), occurredAt: { gte: start, lt: end } };

  const activities = await prisma.salesActivity.findMany({
    where: scope,
    select: { referralSourceId: true, resultedInReferral: true, referredPatientCount: true },
  });

  const distinctSources = new Set(activities.map((a) => a.referralSourceId).filter((id): id is string => !!id));

  return {
    salesActivityCount: activities.length,
    activeReferralSourceCount: distinctSources.size,
    referralCount: activities.reduce((sum, a) => (a.resultedInReferral ? sum + a.referredPatientCount : sum), 0),
  };
}
