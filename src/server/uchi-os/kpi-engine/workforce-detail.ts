// DR-07「過稼働」用の職員別データ集計。個人の訪問時間と拠点平均を比較する。

import { prisma } from "@/server/uchi-os/db/client";
import { monthRange } from "./dates";

export interface EmployeeWorkload {
  employeeId: string;
  name: string;
  visitMinutes: number;
  workloadIndex: number | null; // 本人の訪問時間 ÷ 拠点看護師平均訪問時間
}

export async function getEmployeeWorkloads(
  organizationId: string,
  stationId: string,
  yearMonth: string,
): Promise<EmployeeWorkload[]> {
  const { start, end } = monthRange(yearMonth);

  const nurses = await prisma.employee.findMany({
    where: {
      organizationId,
      stationId,
      employeeType: "NURSE",
      hiredAt: { lt: end },
      OR: [{ resignedAt: null }, { resignedAt: { gte: end } }],
    },
    select: { id: true, name: true },
  });
  if (nurses.length === 0) return [];

  const visits = await prisma.visit.groupBy({
    by: ["employeeId"],
    where: { organizationId, stationId, visitedAt: { gte: start, lt: end }, employeeId: { in: nurses.map((n) => n.id) } },
    _sum: { durationMinutes: true },
  });
  const minutesByEmployee = new Map(visits.map((v) => [v.employeeId, v._sum.durationMinutes ?? 0]));

  const totalMinutes = nurses.reduce((sum, n) => sum + (minutesByEmployee.get(n.id) ?? 0), 0);
  const averageMinutes = nurses.length > 0 ? totalMinutes / nurses.length : 0;

  return nurses.map((n) => {
    const visitMinutes = minutesByEmployee.get(n.id) ?? 0;
    return {
      employeeId: n.id,
      name: n.name,
      visitMinutes,
      workloadIndex: averageMinutes > 0 ? visitMinutes / averageMinutes : null,
    };
  });
}
