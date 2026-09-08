import { prisma } from "@/server/uchi-os/db/client";
import { computeMonthlyKpis } from "./compute";
import type { Prisma } from "@prisma/client";

/**
 * 指定した組織・年月について、全拠点＋法人全体のKPISnapshotを再計算しupsertする。
 * 日次バッチ (10.9節 /api/uchi-os/internal/jobs/kpi-recompute) およびシード投入から呼ばれる。
 */
export async function recomputeKpiSnapshotsForMonth(organizationId: string, yearMonth: string): Promise<number> {
  const stations = await prisma.station.findMany({ where: { organizationId }, select: { id: true } });
  const scopes: (string | null)[] = [null, ...stations.map((s) => s.id)];

  let count = 0;
  for (const stationId of scopes) {
    const kpis = await computeMonthlyKpis(organizationId, stationId, yearMonth);
    const rows: Prisma.KPISnapshotCreateManyInput[] = kpis.map((kpi) => ({
      organizationId,
      stationId,
      yearMonth,
      kpiCode: kpi.kpiCode,
      value: kpi.value,
      insufficientData: kpi.insufficientData,
      valueType: kpi.valueType,
    }));

    if (stationId === null) {
      // Postgres の複合UNIQUE制約はNULL列を「別値」として扱うため、stationId=nullの行には
      // upsert(ON CONFLICT)が効かない。この場合のみ削除→再作成で冪等性を担保する。
      await prisma.kPISnapshot.deleteMany({ where: { organizationId, stationId: null, yearMonth } });
      await prisma.kPISnapshot.createMany({ data: rows });
    } else {
      for (const kpi of kpis) {
        await prisma.kPISnapshot.upsert({
          where: {
            organizationId_stationId_yearMonth_kpiCode: { organizationId, stationId, yearMonth, kpiCode: kpi.kpiCode },
          },
          create: {
            organizationId,
            stationId,
            yearMonth,
            kpiCode: kpi.kpiCode,
            value: kpi.value,
            insufficientData: kpi.insufficientData,
            valueType: kpi.valueType,
          },
          update: { value: kpi.value, insufficientData: kpi.insufficientData, valueType: kpi.valueType },
        });
      }
    }
    count += rows.length;
  }
  return count;
}
