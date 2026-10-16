// 画面用のデータ取得
import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "./db";
import type { SnapshotData } from "./recalc";

export type Origin = "REAL" | "SAMPLE";

export function originFromParam(v: string | string[] | undefined): Origin {
  return v === "sample" ? "SAMPLE" : "REAL";
}

/** 要確認の取引（未分類・税社保・科目未設定の経費） */
export const NEEDS_REVIEW_WHERE: Prisma.BankTransactionWhereInput = {
  OR: [
    { category: { in: ["UNCLASSIFIED", "TAX_SOCIAL"] } },
    { category: { in: ["EXPENSE", "PAYROLL"] }, accountTitle: null },
  ],
};

export async function listSnapshots(db: Db, origin: Origin) {
  const rows = await db.monthlySnapshot.findMany({ where: { origin, unit: "COMPANY" }, orderBy: { yearMonth: "asc" } });
  return rows.map((r) => ({ ...r, data: r.data as unknown as SnapshotData }));
}

export async function dataFreshness(db: Db, origin: Origin) {
  const [lastImport, lastRun, lastFailed] = await Promise.all([
    db.importBatch.findFirst({ where: { origin, status: { in: ["SUCCEEDED", "PARTIAL"] } }, orderBy: { finishedAt: "desc" } }),
    db.recalcRun.findFirst({ where: { status: "SUCCEEDED" }, orderBy: { finishedAt: "desc" } }),
    db.recalcRun.findFirst({ where: { status: "FAILED" }, orderBy: { startedAt: "desc" } }),
  ]);
  return {
    lastImportAt: lastImport?.finishedAt ?? null,
    lastRecalcAt: lastRun?.finishedAt ?? null,
    lastRecalcFailedAt: lastFailed && (!lastRun?.finishedAt || lastFailed.startedAt > lastRun.finishedAt) ? lastFailed.startedAt : null,
  };
}

export async function reviewStats(db: Db, origin: Origin, yearMonth?: string) {
  const where: Prisma.BankTransactionWhereInput = { origin, ...NEEDS_REVIEW_WHERE, ...(yearMonth ? { yearMonth } : {}) };
  const agg = await db.bankTransaction.aggregate({ where, _count: true, _sum: { withdrawal: true, deposit: true } });
  return { count: agg._count, amount: (agg._sum.withdrawal ?? 0) + (agg._sum.deposit ?? 0) };
}

export async function heldCounts(db: Db) {
  const [rev, tb, metrics] = await Promise.all([
    db.revenueFact.findMany({ where: { origin: "REAL", state: "HELD" }, select: { yearMonth: true } }),
    db.trialBalanceLine.findMany({ where: { origin: "REAL", state: "HELD" }, select: { yearMonth: true }, distinct: ["yearMonth", "segment", "batchId"] }),
    db.metricValue.findMany({ where: { origin: "REAL", state: "HELD" }, select: { yearMonth: true } }),
  ]);
  const byMonth = new Map<string, number>();
  for (const r of [...rev, ...tb, ...metrics]) if (r.yearMonth) byMonth.set(r.yearMonth, (byMonth.get(r.yearMonth) ?? 0) + 1);
  return byMonth;
}

export async function hasOrigin(db: Db, origin: Origin) {
  return (await db.monthlySnapshot.count({ where: { origin } })) > 0;
}
