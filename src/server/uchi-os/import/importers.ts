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

async function importStations(organizationId: string, csvText: string): Promise<ImportResult> {
  const rows = parseCsv(csvText);
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

async function importFinancialMonthly(organizationId: string, csvText: string): Promise<ImportResult> {
  const rows = parseCsv(csvText);
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

export async function runImport(organizationId: string, entity: ImportEntity, csvText: string): Promise<ImportResult> {
  if (entity === "stations") return importStations(organizationId, csvText);
  return importFinancialMonthly(organizationId, csvText);
}
