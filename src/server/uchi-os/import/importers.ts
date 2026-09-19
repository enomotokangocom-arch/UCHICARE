import { parse } from "csv-parse/sync";
import { prisma } from "@/server/uchi-os/db/client";
import { stationRowSchema, financialMonthlyRowSchema, type ImportEntity } from "./schemas";

export interface ImportResult {
  rowCount: number;
  errorCount: number;
  errors: { row: number; message: string }[];
}

function parseCsv(csvText: string): Record<string, string>[] {
  return parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
}

// 14章 Adapter Layer: CSV由来(文字列)・REST/JSON由来(文字列/数値混在)のどちらの行データも
// 同じ行処理ロジック(processStationRows/processFinancialMonthlyRows)を通す。
// zodスキーマ側で z.coerce を使っているため、型の違いはここで吸収される。
async function processStationRows(organizationId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];

  for (const [i, raw] of rows.entries()) {
    const parsed = stationRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: i + 2, message: parsed.error.issues.map((e) => e.message).join(", ") });
      continue;
    }
    const { name, address, openedAt } = parsed.data;
    // Station は (organizationId, name) の複合UNIQUE制約を持たないため upsert ではなく findFirst で分岐する。
    const existing = await prisma.station.findFirst({ where: { organizationId, name } });
    const data = { address, openedAt: openedAt ? new Date(openedAt) : undefined };
    if (existing) {
      await prisma.station.update({ where: { id: existing.id }, data });
    } else {
      await prisma.station.create({ data: { organizationId, name, ...data } });
    }
  }

  return { rowCount: rows.length, errorCount: errors.length, errors };
}

async function processFinancialMonthlyRows(organizationId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];

  for (const [i, raw] of rows.entries()) {
    const parsed = financialMonthlyRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: i + 2, message: parsed.error.issues.map((e) => e.message).join(", ") });
      continue;
    }
    const { stationName, yearMonth, revenue, laborCost, otherFixedCost, otherVariableCost, cashBalance } = parsed.data;

    let stationId: string | null = null;
    if (stationName && stationName.trim() !== "") {
      const station = await prisma.station.findFirst({ where: { organizationId, name: stationName } });
      if (!station) {
        errors.push({ row: i + 2, message: `拠点「${stationName}」が見つかりません。先に拠点を登録してください。` });
        continue;
      }
      stationId = station.id;
    }

    const financialData = {
      revenue,
      laborCost,
      otherFixedCost: otherFixedCost ?? 0,
      otherVariableCost: otherVariableCost ?? 0,
      cashBalance: cashBalance ?? null,
    };

    if (stationId === null) {
      // Postgres の複合UNIQUE制約はNULL列を別値として扱うため、HQ行(stationId=null)には
      // upsert(ON CONFLICT)が効かない。findFirstで明示的に分岐する(kpi-engine/snapshot.tsと同じ理由)。
      const existing = await prisma.financialRecord.findFirst({ where: { organizationId, stationId: null, yearMonth } });
      if (existing) {
        await prisma.financialRecord.update({ where: { id: existing.id }, data: financialData });
      } else {
        await prisma.financialRecord.create({ data: { organizationId, stationId: null, yearMonth, ...financialData } });
      }
    } else {
      await prisma.financialRecord.upsert({
        where: { organizationId_stationId_yearMonth: { organizationId, stationId, yearMonth } },
        create: { organizationId, stationId, yearMonth, ...financialData },
        update: financialData,
      });
    }
  }

  return { rowCount: rows.length, errorCount: errors.length, errors };
}

/** entityコードに対応する行処理関数を呼ぶ。CSV importとAdapter Layer(REST/JSON)の共通入口。 */
export async function processRowsForEntity(
  organizationId: string,
  entity: ImportEntity,
  rows: Record<string, unknown>[],
): Promise<ImportResult> {
  if (entity === "stations") return processStationRows(organizationId, rows);
  return processFinancialMonthlyRows(organizationId, rows);
}

export async function runImport(organizationId: string, entity: ImportEntity, csvText: string): Promise<ImportResult> {
  return processRowsForEntity(organizationId, entity, parseCsv(csvText));
}
