// 再計算サービス。冪等で、確定月（実データ）のスナップショットは変更しない。
// 毎朝8時（JST）に /api/mos/cron/recalculate から呼ばれるほか、取込・手動分類・確定時にも呼ぶ。
import type { Prisma } from "@/generated/prisma/client";
import { computeKpi, type MonthKpi } from "../domain/kpi";
import { computeMonthPL, type BankExpense, type MonthPL, type OperationalRevenue, type TbRow } from "../domain/pl";
import { EXPENSE_CATEGORIES, type BusinessUnit } from "../domain/types";
import type { Db } from "./db";
import { loadAccounts, loadSettings } from "./settings";

export type Origin = "REAL" | "SAMPLE";
export type SnapshotData = { pl: MonthPL; kpi: MonthKpi };

/** データが存在する年月の一覧 */
export async function monthsWithData(db: Db, origin: Origin): Promise<string[]> {
  const [rev, tb, tx, visits, metrics] = await Promise.all([
    db.revenueFact.findMany({ where: { origin, state: "ACTIVE" }, select: { yearMonth: true }, distinct: ["yearMonth"] }),
    db.trialBalanceLine.findMany({ where: { origin, state: "ACTIVE", yearMonth: { not: null } }, select: { yearMonth: true }, distinct: ["yearMonth"] }),
    db.bankTransaction.findMany({ where: { origin }, select: { yearMonth: true }, distinct: ["yearMonth"] }),
    db.visitRecord.findMany({ where: { origin }, select: { yearMonth: true }, distinct: ["yearMonth"] }),
    db.metricValue.findMany({ where: { origin, state: "ACTIVE" }, select: { yearMonth: true }, distinct: ["yearMonth"] }),
  ]);
  const set = new Set<string>();
  for (const r of [...rev, ...tb, ...tx, ...visits, ...metrics]) if (r.yearMonth) set.add(r.yearMonth);
  return [...set].sort();
}

/** 1か月分の損益・KPI を計算する（保存はしない） */
export async function computeMonth(db: Db, origin: Origin, yearMonth: string, closed: boolean): Promise<SnapshotData> {
  const [settings, accounts, tbLines, facts, txs, visits, metrics, capacity, targets] = await Promise.all([
    loadSettings(db),
    loadAccounts(db),
    db.trialBalanceLine.findMany({ where: { origin, yearMonth, state: "ACTIVE" } }),
    db.revenueFact.findMany({ where: { origin, yearMonth, state: "ACTIVE" } }),
    db.bankTransaction.findMany({ where: { origin, yearMonth, category: { in: EXPENSE_CATEGORIES }, accountTitle: { not: null } } }),
    db.visitRecord.findMany({ where: { origin, yearMonth } }),
    db.metricValue.findMany({ where: { origin, yearMonth, state: "ACTIVE" } }),
    db.staffCapacity.findMany({ where: { yearMonth } }),
    db.target.findMany({ where: { yearMonth } }),
  ]);

  const trialBalance: TbRow[] | null = tbLines.length
    ? tbLines.filter((l) => l.segment !== "HQ").map((l) => ({ segment: l.segment as TbRow["segment"], accountName: l.accountName, amount: l.amount }))
    : null;
  const operationalRevenue: OperationalRevenue[] = facts
    .filter((f) => f.unit === "HOMONKANGO" || f.unit === "KYOTAKU")
    .map((f) => ({ unit: f.unit as BusinessUnit, amount: f.amount, source: f.source }));
  const bankExpenses: BankExpense[] = txs.map((t) => ({
    accountTitle: t.accountTitle!,
    unit: t.unit === "HOMONKANGO" || t.unit === "KYOTAKU" ? t.unit : null,
    allocation: t.allocation ?? "COMMON",
    behavior: t.behavior,
    amount: t.withdrawal - t.deposit,
  }));

  const pl = computeMonthPL({
    yearMonth,
    closed,
    trialBalance,
    operationalRevenue,
    bankExpenses,
    accounts,
    allocation: settings.allocation,
    tolerance: settings.tolerance,
  });

  const kyotakuFact = facts.find((f) => f.source === "KYOTAKU_SHEET");
  const detail = kyotakuFact?.detail as { care?: { thisMonthCount: number }; support?: { thisMonthCount: number } } | null | undefined;
  const kyotakuBilledUsers = detail?.care && detail?.support ? detail.care.thisMonthCount + detail.support.thisMonthCount : null;

  const kpi = computeKpi({
    yearMonth,
    visits: visits.map((v) => ({ source: v.source, kind: v.kind, unit: v.unit, jobType: v.jobType, cancelled: v.cancelled, minutes: v.minutes, subjectKey: v.subjectKey })),
    metrics: metrics.map((m) => ({ source: m.source, metricKey: m.metricKey, unit: m.unit, value: m.value })),
    kyotakuBilledUsers,
    capacity: capacity.map((c) => ({ unit: c.unit, jobType: c.jobType, headcount: c.headcount, availableMinutes: c.availableMinutes })),
    targets: targets.map((t) => ({ unit: t.unit, metric: t.metric, value: t.value })),
    pl,
  });
  return { pl, kpi };
}

async function writeSnapshot(db: Db, origin: Origin, yearMonth: string, data: SnapshotData, frozen: boolean) {
  await db.monthlySnapshot.upsert({
    where: { origin_yearMonth_unit: { origin, yearMonth, unit: "COMPANY" } },
    update: { data: data as unknown as Prisma.InputJsonValue, valueStatus: data.pl.status, computedAt: new Date(), frozen },
    create: { origin, yearMonth, unit: "COMPANY", data: data as unknown as Prisma.InputJsonValue, valueStatus: data.pl.status, frozen },
  });
}

export async function recalculate(
  db: Db,
  opts: { trigger: "CRON" | "MANUAL" | "IMPORT" | "CLOSE"; origin?: Origin; months?: string[] },
): Promise<{ runId: string; months: number }> {
  const run = await db.recalcRun.create({ data: { trigger: opts.trigger, status: "RUNNING" } });
  try {
    let count = 0;
    const origins: Origin[] = opts.origin ? [opts.origin] : ["REAL", "SAMPLE"];
    for (const origin of origins) {
      const closed =
        origin === "REAL" ? new Set((await db.monthClose.findMany({ where: { status: "CLOSED" } })).map((c) => c.yearMonth)) : new Set<string>();
      const months = opts.months ?? (await monthsWithData(db, origin));
      for (const ym of months) {
        if (closed.has(ym)) continue; // 確定月は凍結（再計算しない）
        await writeSnapshot(db, origin, ym, await computeMonth(db, origin, ym, false), false);
        count++;
      }
    }
    await db.recalcRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", finishedAt: new Date(), months: count } });
    return { runId: run.id, months: count };
  } catch (e) {
    await db.recalcRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), message: String(e).slice(0, 500) } });
    throw e;
  }
}

/** 月次確定: 確定値として計算し、スナップショットを凍結する（実データのみ） */
export async function closeMonth(db: Db, yearMonth: string, userId: string) {
  const current = await db.monthClose.findUnique({ where: { yearMonth } });
  if (current?.status === "CLOSED") throw new Error(`${yearMonth} は既に確定済みです`);
  const tbCount = await db.trialBalanceLine.count({ where: { origin: "REAL", yearMonth, state: "ACTIVE" } });
  if (tbCount === 0) throw new Error(`${yearMonth} の試算表が取込まれていないため確定できません`);
  const data = await computeMonth(db, "REAL", yearMonth, true);
  await db.$transaction(async (tx) => {
    await tx.monthClose.upsert({
      where: { yearMonth },
      update: { status: "CLOSED", closedAt: new Date(), closedById: userId },
      create: { yearMonth, status: "CLOSED", closedAt: new Date(), closedById: userId },
    });
    await tx.auditLog.create({ data: { userId, action: "MONTH_CLOSED", target: yearMonth } });
  });
  await writeSnapshot(db, "REAL", yearMonth, data, true);
  await db.recalcRun.create({ data: { trigger: "CLOSE", status: "SUCCEEDED", finishedAt: new Date(), months: 1, message: yearMonth } });
}

/** 確定解除: 理由必須・監査ログに記録 */
export async function reopenMonth(db: Db, yearMonth: string, userId: string, reason: string) {
  if (!reason.trim()) throw new Error("確定解除の理由を入力してください");
  const current = await db.monthClose.findUnique({ where: { yearMonth } });
  if (current?.status !== "CLOSED") throw new Error(`${yearMonth} は確定されていません`);
  await db.$transaction(async (tx) => {
    await tx.monthClose.update({ where: { yearMonth }, data: { status: "OPEN", reopenedAt: new Date(), reopenReason: reason } });
    await tx.auditLog.create({ data: { userId, action: "MONTH_REOPENED", target: yearMonth, detail: { reason } } });
  });
  await recalculate(db, { trigger: "MANUAL", origin: "REAL", months: [yearMonth] });
}
