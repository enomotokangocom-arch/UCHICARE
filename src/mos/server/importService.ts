// ファイル取込サービス。設計: docs/mos/02-design.md §3
import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { classifyTx, matchInternalTransfers } from "../domain/classify";
import { detectSourceType, loadFile, type LoadedFile } from "../domain/detect";
import { formatDate, toUtcDate, yearMonthOf, type CalendarDate } from "../domain/normalize";
import { parseGmo, parseSendai, type ParsedBankTx } from "../domain/parsers/bank";
import { parseIbowImplementation, type IbowVisit } from "../domain/parsers/ibowImplementation";
import { parseIbowSales } from "../domain/parsers/ibowSales";
import { parseKyotaku, type KyotakuMonth } from "../domain/parsers/kyotaku";
import { parseZest } from "../domain/parsers/zest";
import { parseTrialBalancePages, segmentIntegrityDiffs, type TbParseResult } from "../domain/parsers/trialBalance";
import type { Issue, JobType, SourceType } from "../domain/types";
import type { Db } from "./db";
import { recalculate } from "./recalc";
import { loadAccounts, loadRules } from "./settings";

export type Origin = "REAL" | "SAMPLE";

export type ImportContext = {
  db: Db;
  userId: string | null;
  origin: Origin;
  hashSecret: string;
  /** 取込後に再計算するか（テストや一括投入では false にできる） */
  recalc?: boolean;
  /** ZEST 経営指標の対象年月（ファイルに期間が含まれないため利用者が指定する） */
  zestYearMonth?: string | null;
};

type Counters = { totalRows: number; importedRows: number; duplicateRows: number; heldRows: number; months: Set<string> };

const newCounters = (): Counters => ({ totalRows: 0, importedRows: 0, duplicateRows: 0, heldRows: 0, months: new Set() });

export function sha256(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

async function closedMonths(db: Db, origin: Origin): Promise<Set<string>> {
  if (origin !== "REAL") return new Set(); // 月次確定は実データのみ
  const rows = await db.monthClose.findMany({ where: { status: "CLOSED" } });
  return new Set(rows.map((r) => r.yearMonth));
}

function statusFrom(c: Counters, issues: Issue[]): "SUCCEEDED" | "PARTIAL" | "FAILED" {
  const errors = issues.filter((i) => i.severity === "ERROR").length;
  if (errors === 0) return "SUCCEEDED";
  return c.importedRows + c.duplicateRows + c.heldRows > 0 ? "PARTIAL" : "FAILED";
}

async function finalize(
  ctx: ImportContext,
  batchId: string,
  c: Counters,
  issues: Issue[],
  extra: Partial<Prisma.ImportBatchUpdateInput> = {},
) {
  const months = [...c.months].sort();
  await ctx.db.importIssue.createMany({ data: issues.map((i) => ({ ...i, batchId })) });
  const status = statusFrom(c, issues);
  const [errorCount, warningCount] = await Promise.all([
    ctx.db.importIssue.count({ where: { batchId, severity: "ERROR" } }),
    ctx.db.importIssue.count({ where: { batchId, severity: "WARNING" } }),
  ]);
  await ctx.db.importBatch.update({
    where: { id: batchId },
    data: {
      status,
      finishedAt: new Date(),
      totalRows: c.totalRows,
      importedRows: c.importedRows,
      duplicateRows: c.duplicateRows,
      heldRows: c.heldRows,
      errorCount,
      warningCount,
      periodStart: months[0] ?? null,
      periodEnd: months[months.length - 1] ?? null,
      ...extra,
    },
  });
  if (ctx.recalc !== false && months.length) {
    await recalculate(ctx.db, { trigger: "IMPORT", origin: ctx.origin, months });
  }
  return status;
}

export type ImportResult = { batchId: string; status: string };

export async function importFile(ctx: ImportContext, fileName: string, data: Uint8Array): Promise<ImportResult> {
  return importLoaded(ctx, fileName, data, () => loadFile(fileName.normalize("NFC"), data));
}

/** 読み込み処理を差し替えられる取込（テストでは PDF テキスト抽出済みの入力を渡す） */
export async function importLoaded(
  ctx: ImportContext,
  fileName: string,
  data: Uint8Array,
  load: () => Promise<LoadedFile>,
): Promise<ImportResult> {
  const { db } = ctx;
  const hash = sha256(data);
  const name = fileName.normalize("NFC");

  const previous = await db.importBatch.findFirst({
    where: { sha256: hash, origin: ctx.origin, status: { in: ["SUCCEEDED", "PARTIAL"] } },
    orderBy: { createdAt: "asc" },
  });
  if (previous) {
    const b = await db.importBatch.create({
      data: {
        fileName: name,
        fileSize: data.length,
        sha256: hash,
        sourceType: previous.sourceType,
        detectedBy: "sha256",
        origin: ctx.origin,
        status: "DUPLICATE",
        uploadedById: ctx.userId,
        finishedAt: new Date(),
        duplicateOfId: previous.id,
        issues: { create: [{ severity: "INFO", code: "DUPLICATE_FILE", message: "同じ内容のファイルは取込済みのため、データは追加していません" }] },
      },
    });
    return { batchId: b.id, status: b.status };
  }

  const batch = await db.importBatch.create({
    data: { fileName: name, fileSize: data.length, sha256: hash, sourceType: "UNKNOWN", detectedBy: "none", origin: ctx.origin, status: "PROCESSING", uploadedById: ctx.userId },
  });

  try {
    const loaded = await load();
    if (loaded.kind === "unsupported") {
      const status = await finalize(ctx, batch.id, newCounters(), [{ severity: "ERROR", code: "UNSUPPORTED", message: loaded.reason }]);
      return { batchId: batch.id, status };
    }
    const detection = detectSourceType(name, loaded);
    await db.importBatch.update({ where: { id: batch.id }, data: { sourceType: detection.sourceType, detectedBy: detection.detectedBy } });
    if (detection.sourceType === "UNKNOWN") {
      const status = await finalize(ctx, batch.id, newCounters(), detection.issues);
      return { batchId: batch.id, status };
    }
    const status = await processLoaded(ctx, batch.id, detection.sourceType, loaded, detection.issues);
    return { batchId: batch.id, status };
  } catch (e) {
    console.error("[mos] import failed", e);
    await db.importIssue.create({
      data: { batchId: batch.id, severity: "ERROR", code: "INTERNAL", message: "取込処理中にエラーが発生しました。ファイル形式を確認してください" },
    });
    await db.importBatch.update({ where: { id: batch.id }, data: { status: "FAILED", finishedAt: new Date(), errorCount: { increment: 1 } } });
    return { batchId: batch.id, status: "FAILED" };
  }
}

async function processLoaded(
  ctx: ImportContext,
  batchId: string,
  sourceType: SourceType,
  loaded: LoadedFile,
  issues: Issue[],
): Promise<string> {
  const c = newCounters();
  const sheets = loaded.kind === "xlsx" || loaded.kind === "csv" || loaded.kind === "zip" ? loaded.sheets : [];

  switch (sourceType) {
    case "BANK_GMO":
    case "BANK_SENDAI": {
      const r = sourceType === "BANK_GMO" ? parseGmo(sheets) : parseSendai(sheets);
      issues.push(...r.issues);
      c.totalRows = r.totalRows;
      await persistBank(ctx, batchId, r.transactions, c, issues);
      return finalize(ctx, batchId, c, issues);
    }
    case "KYOTAKU_SALES_XLSX": {
      const r = parseKyotaku(sheets);
      issues.push(...r.issues);
      c.totalRows = r.totalRows;
      await persistKyotaku(ctx, batchId, r.months, c, issues);
      return finalize(ctx, batchId, c, issues);
    }
    case "TRIAL_BALANCE_PDF": {
      if (loaded.kind !== "pdf") throw new Error("PDF ではありません");
      const r = parseTrialBalancePages(loaded.pages);
      issues.push(...r.issues);
      c.totalRows = r.totalRows;
      await persistTrialBalance(ctx, batchId, r, c, issues);
      return finalize(ctx, batchId, c, issues);
    }
    case "IBOW_SALES_CSV": {
      const r = parseIbowSales(sheets);
      issues.push(...r.issues);
      c.totalRows = r.totalRows;
      if (r.month) {
        await persistRevenue(
          ctx,
          batchId,
          "IBOW_SALES",
          [{ yearMonth: r.month.yearMonth, unit: "HOMONKANGO", amount: r.month.totalAmount, quantity: r.month.users, detail: { byKind: r.month.byKind, users: r.month.users } }],
          c,
          issues,
        );
      }
      return finalize(ctx, batchId, c, issues);
    }
    case "IBOW_IMPLEMENTATION_XLSX": {
      const r = parseIbowImplementation(sheets, ctx.hashSecret);
      issues.push(...r.issues);
      c.totalRows = r.totalRows;
      await persistVisits(ctx, batchId, "IBOW", "ACTUAL", r.visits.map(ibowToVisit), c, issues);
      return finalize(ctx, batchId, c, issues);
    }
    case "ZEST_METRICS_ZIP": {
      const r = parseZest(sheets, ctx.zestYearMonth ?? null);
      issues.push(...r.issues);
      c.totalRows = r.totalRows;
      if (!r.issues.some((i) => i.code.startsWith("PERIOD") || i.code === "DAY_CHECK_MISSING")) {
        await persistMetrics(ctx, batchId, "ZEST", r.metrics.map((m) => ({ ...m, yearMonth: ctx.zestYearMonth!, unit: "HOMONKANGO" as const })), c, issues);
      }
      return finalize(ctx, batchId, c, issues);
    }
    default:
      throw new Error(`未対応の種別 ${sourceType}`);
  }
}

// ---------- 銀行明細 ----------

function accountKey(t: ParsedBankTx) {
  return sha256(`${t.bank}:${t.accountIdentifier}`);
}

export function bankFingerprints(txs: ParsedBankTx[]): string[] {
  const seen = new Map<string, number>();
  return txs.map((t) => {
    const base = [t.bank, accountKey(t), formatDate(t.date), t.seq ?? "", t.description, t.deposit, t.withdrawal, t.balance ?? ""].join("|");
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return sha256(`${base}|${n}`);
  });
}

async function persistBank(ctx: ImportContext, batchId: string, txs: ParsedBankTx[], c: Counters, issues: Issue[]) {
  const { db } = ctx;
  const closed = await closedMonths(db, ctx.origin);
  const fps = bankFingerprints(txs);
  const accountIds = new Map<string, string>();
  const rows: Prisma.BankTransactionCreateManyInput[] = [];
  const heldByMonth = new Map<string, number>();
  for (let i = 0; i < txs.length; i++) {
    const t = txs[i];
    const ym = yearMonthOf(t.date);
    if (closed.has(ym)) {
      heldByMonth.set(ym, (heldByMonth.get(ym) ?? 0) + 1);
      continue;
    }
    const key = accountKey(t);
    if (!accountIds.has(key)) {
      const last4 = (t.accountIdentifier.match(/(\d{4})\D*$/)?.[1] ?? "----").slice(-4);
      const acct = await db.bankAccount.upsert({
        where: { accountKey: key },
        update: {},
        create: { bank: t.bank, accountKey: key, last4, label: t.accountLabel },
      });
      accountIds.set(key, acct.id);
    }
    rows.push({
      batchId,
      origin: ctx.origin,
      accountId: accountIds.get(key)!,
      txDate: toUtcDate(t.date),
      yearMonth: ym,
      seq: t.seq,
      description: t.description,
      memo: t.memo,
      txType: t.txType,
      counterpartyBank: t.counterpartyBank,
      deposit: t.deposit,
      withdrawal: t.withdrawal,
      balance: t.balance,
      fingerprint: fps[i],
    });
  }
  for (const [ym, n] of heldByMonth) {
    c.heldRows += n;
    issues.push({ severity: "WARNING", code: "CLOSED_MONTH", message: `${ym} は確定済みのため、この月の明細 ${n} 件は取込んでいません（確定を解除すると取込めます）` });
  }
  const inserted = rows.length ? (await db.bankTransaction.createMany({ data: rows, skipDuplicates: true })).count : 0;
  c.importedRows += inserted;
  c.duplicateRows += rows.length - inserted;
  if (rows.length - inserted > 0) {
    issues.push({ severity: "INFO", code: "DUPLICATE_ROWS", message: `取込済みの明細 ${rows.length - inserted} 件は重複のためスキップしました` });
  }
  const newTx = await db.bankTransaction.findMany({ where: { batchId } });
  for (const t of newTx) c.months.add(t.yearMonth);
  await classifyTransactions(db, newTx.map((t) => t.id));
}

/** 指定した取引を自動分類し、口座間振替を照合する（手動分類済みの取引は変更しない） */
export async function classifyTransactions(db: Db, ids: string[]) {
  if (ids.length === 0) return;
  const [rules, accountList] = await Promise.all([loadRules(db), loadAccounts(db)]);
  const accounts = new Map(accountList.map((a) => [a.name, a]));
  const txs = await db.bankTransaction.findMany({ where: { id: { in: ids }, classifiedBy: { not: "MANUAL" } }, include: { account: true } });
  for (const t of txs) {
    const cls = classifyTx(
      { id: t.id, bank: t.account.bank, accountId: t.accountId, date: t.txDate.toISOString().slice(0, 10), description: t.description, memo: t.memo, deposit: t.deposit, withdrawal: t.withdrawal },
      rules,
      accounts,
    );
    await db.bankTransaction.update({
      where: { id: t.id },
      data: { category: cls.category, accountTitle: cls.accountTitle, unit: cls.unit, allocation: cls.allocation, behavior: cls.behavior, classifiedBy: cls.classifiedBy, ruleId: cls.ruleId },
    });
  }
  if (txs.length === 0) return;
  // 振替照合: 取込範囲の前後3日を含めて、未ペアの取引から探す
  const dates = txs.map((t) => t.txDate.getTime());
  const from = new Date(Math.min(...dates) - 3 * 86_400_000);
  const to = new Date(Math.max(...dates) + 3 * 86_400_000);
  const origin = txs[0].origin;
  const pool = await db.bankTransaction.findMany({
    where: {
      origin,
      txDate: { gte: from, lte: to },
      transferPairId: null,
      classifiedBy: { not: "MANUAL" },
      category: { in: ["UNCLASSIFIED", "INTERNAL_TRANSFER"] },
    },
    include: { account: true },
  });
  const pairs = matchInternalTransfers(
    pool.map((t) => ({ id: t.id, bank: t.account.bank, accountId: t.accountId, date: t.txDate.toISOString().slice(0, 10), description: t.description, memo: t.memo, deposit: t.deposit, withdrawal: t.withdrawal })),
  );
  for (const p of pairs) {
    const pairId = randomUUID();
    await db.bankTransaction.updateMany({
      where: { id: { in: [p.outId, p.inId] } },
      data: { category: "INTERNAL_TRANSFER", classifiedBy: "TRANSFER_MATCH", transferPairId: pairId, accountTitle: null, unit: null, allocation: null, behavior: null },
    });
  }
}

// ---------- 月次集計系（版管理） ----------

type FactPlan = "DUPLICATE" | "HELD" | "ACTIVE";

function stable(v: unknown): string {
  return JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));
}

async function persistRevenue(
  ctx: ImportContext,
  batchId: string,
  source: "KYOTAKU_SHEET" | "IBOW_SALES",
  facts: { yearMonth: string; unit: "HOMONKANGO" | "KYOTAKU"; amount: number; quantity: number | null; detail: unknown }[],
  c: Counters,
  issues: Issue[],
) {
  const { db } = ctx;
  const closed = await closedMonths(db, ctx.origin);
  for (const f of facts) {
    const where = { origin: ctx.origin, source, unit: f.unit, yearMonth: f.yearMonth } as const;
    const same = (x: { amount: number; quantity: number | null; detail: unknown }) =>
      x.amount === f.amount && x.quantity === f.quantity && stable(x.detail) === stable(f.detail);
    const active = await db.revenueFact.findFirst({ where: { ...where, state: "ACTIVE" } });
    let plan: FactPlan;
    if (active && same(active)) plan = "DUPLICATE";
    else if (closed.has(f.yearMonth)) {
      const held = await db.revenueFact.findMany({ where: { ...where, state: "HELD" } });
      plan = held.some(same) ? "DUPLICATE" : "HELD";
    } else plan = "ACTIVE";

    if (plan === "DUPLICATE") {
      c.duplicateRows++;
      continue;
    }
    await db.$transaction(async (tx) => {
      if (plan === "ACTIVE" && active) await tx.revenueFact.update({ where: { id: active.id }, data: { state: "SUPERSEDED" } });
      await tx.revenueFact.create({
        data: { ...where, batchId, amount: f.amount, quantity: f.quantity, detail: (f.detail ?? undefined) as Prisma.InputJsonValue | undefined, state: plan },
      });
    });
    if (plan === "HELD") {
      c.heldRows++;
      issues.push({
        severity: "WARNING",
        code: "CLOSED_MONTH",
        message: `${f.yearMonth} は確定済みのため、新しい値（${f.amount.toLocaleString()}円）は保留しました。照合画面で確認してください`,
      });
    } else {
      c.importedRows++;
      c.months.add(f.yearMonth);
      if (active) issues.push({ severity: "INFO", code: "UPDATED", message: `${f.yearMonth} の売上を更新しました（${active.amount.toLocaleString()}円 → ${f.amount.toLocaleString()}円）` });
    }
  }
}

async function persistKyotaku(ctx: ImportContext, batchId: string, months: KyotakuMonth[], c: Counters, issues: Issue[]) {
  await persistRevenue(
    ctx,
    batchId,
    "KYOTAKU_SHEET",
    months.map((m) => ({
      yearMonth: m.yearMonth,
      unit: "KYOTAKU" as const,
      amount: m.totalAmount,
      quantity: m.care.count + m.support.count,
      detail: { care: m.care, support: m.support, commission: m.commission, certificationAmount: m.certificationAmount, sheet: m.sheet },
    })),
    c,
    issues,
  );
}

async function persistTrialBalance(ctx: ImportContext, batchId: string, r: TbParseResult, c: Counters, issues: Issue[]) {
  const { db } = ctx;
  if (r.fiscalYear === null || r.lines.length === 0) return;
  const closed = await closedMonths(db, ctx.origin);
  const segments = [...new Set(r.lines.map((l) => l.segment))];
  const groups: { segment: (typeof segments)[number]; yearMonth: string | null; lines: { accountName: string; amount: number }[] }[] = [];
  for (const segment of segments) {
    const segLines = r.lines.filter((l) => l.segment === segment);
    for (const ym of r.bookedMonths) {
      groups.push({ segment, yearMonth: ym, lines: segLines.map((l) => ({ accountName: l.accountName, amount: l.monthly.find((m) => m.yearMonth === ym)!.amount })) });
    }
    const closing = segLines.filter((l) => l.closing !== 0);
    if (closing.length) groups.push({ segment, yearMonth: null, lines: closing.map((l) => ({ accountName: l.accountName, amount: l.closing })) });
  }
  const asKey = (lines: { accountName: string; amount: number }[]) => stable(Object.fromEntries(lines.map((l) => [l.accountName, l.amount])));

  for (const g of groups) {
    const where = { origin: ctx.origin, fiscalYear: r.fiscalYear, segment: g.segment, yearMonth: g.yearMonth } as const;
    const active = await db.trialBalanceLine.findMany({ where: { ...where, state: "ACTIVE" } });
    const key = asKey(g.lines);
    let plan: FactPlan;
    if (active.length && asKey(active) === key) plan = "DUPLICATE";
    else if (g.yearMonth && closed.has(g.yearMonth)) {
      const held = await db.trialBalanceLine.findMany({ where: { ...where, state: "HELD" } });
      const heldBatches = new Map<string, typeof held>();
      for (const h of held) heldBatches.set(h.batchId, [...(heldBatches.get(h.batchId) ?? []), h]);
      plan = [...heldBatches.values()].some((x) => asKey(x) === key) ? "DUPLICATE" : "HELD";
    } else plan = "ACTIVE";

    if (plan === "DUPLICATE") {
      c.duplicateRows += g.lines.length;
      continue;
    }
    await db.$transaction(async (tx) => {
      if (plan === "ACTIVE" && active.length) {
        await tx.trialBalanceLine.updateMany({ where: { id: { in: active.map((a) => a.id) } }, data: { state: "SUPERSEDED" } });
      }
      await tx.trialBalanceLine.createMany({ data: g.lines.map((l) => ({ ...where, ...l, batchId, state: plan })) });
    });
    if (plan === "HELD") {
      c.heldRows += g.lines.length;
      issues.push({ severity: "WARNING", code: "CLOSED_MONTH", message: `${g.yearMonth}（${g.segment}）は確定済みのため、試算表の新しい値は保留しました。照合画面で確認してください` });
    } else {
      c.importedRows += g.lines.length;
      if (g.yearMonth) c.months.add(g.yearMonth);
      if (active.length) issues.push({ severity: "INFO", code: "UPDATED", message: `${g.yearMonth ?? "決算仕訳"}（${g.segment}）の試算表を新しい版に更新しました` });
    }
  }

  // 部門整合性（全社＝訪問看護＋居宅支援）
  const accounts = new Map((await loadAccounts(db)).map((a) => [a.name, a]));
  const rows = r.lines
    .filter((l) => accounts.get(l.accountName)?.section !== "SUBTOTAL")
    .flatMap((l) => l.monthly.filter((m) => r.bookedMonths.includes(m.yearMonth)).map((m) => ({ segment: l.segment, accountName: l.accountName, yearMonth: m.yearMonth, amount: m.amount })));
  for (const d of segmentIntegrityDiffs(rows)) {
    issues.push({ severity: "WARNING", code: "SEGMENT_MISMATCH", message: `${d.yearMonth} ${d.accountName}: 全社 ${d.company.toLocaleString()}円 ≠ 部門合計 ${d.units.toLocaleString()}円` });
  }
  const unknown = [...new Set(r.lines.map((l) => l.accountName).filter((n) => !accounts.has(n)))];
  if (unknown.length) issues.push({ severity: "WARNING", code: "UNKNOWN_ACCOUNT", message: `科目マスタにない科目があります（${unknown.join("、")}）。設定画面で登録してください` });
}

// ---------- 訪問記録・指標 ----------

type VisitInput = {
  date: CalendarDate;
  yearMonth: string;
  unit: "HOMONKANGO" | "KYOTAKU";
  staffKey: string | null;
  jobType: JobType | null;
  subjectKey: string | null;
  minutes: number | null;
  category: string | null;
  cancelled: boolean;
  dupKey: string;
};

function ibowToVisit(v: IbowVisit): VisitInput {
  return { ...v, unit: "HOMONKANGO", jobType: null, cancelled: false };
}

async function persistVisits(
  ctx: ImportContext,
  batchId: string,
  source: "IBOW" | "ZEST",
  kind: "ACTUAL" | "SCHEDULED",
  visits: VisitInput[],
  c: Counters,
  issues: Issue[],
) {
  const closed = await closedMonths(ctx.db, ctx.origin);
  const seen = new Map<string, number>();
  const rows: Prisma.VisitRecordCreateManyInput[] = [];
  let held = 0;
  for (const v of visits) {
    const n = seen.get(v.dupKey) ?? 0;
    seen.set(v.dupKey, n + 1);
    if (closed.has(v.yearMonth)) {
      held++;
      continue;
    }
    rows.push({
      batchId,
      origin: ctx.origin,
      source,
      kind,
      visitDate: toUtcDate(v.date),
      yearMonth: v.yearMonth,
      unit: v.unit,
      staffKey: v.staffKey,
      jobType: v.jobType,
      subjectKey: v.subjectKey,
      minutes: v.minutes,
      category: v.category,
      cancelled: v.cancelled,
      fingerprint: sha256(`${source}|${kind}|${v.dupKey}|${n}`),
    });
  }
  if (held) {
    c.heldRows += held;
    issues.push({ severity: "WARNING", code: "CLOSED_MONTH", message: `確定済みの月の訪問記録 ${held} 件は取込んでいません` });
  }
  const inserted = rows.length ? (await ctx.db.visitRecord.createMany({ data: rows, skipDuplicates: true })).count : 0;
  c.importedRows += inserted;
  c.duplicateRows += rows.length - inserted;
  if (rows.length - inserted > 0) {
    issues.push({ severity: "INFO", code: "DUPLICATE_ROWS", message: `取込済みの訪問記録 ${rows.length - inserted} 件は重複のためスキップしました` });
  }
  for (const v of rows) c.months.add(v.yearMonth);
}

async function persistMetrics(
  ctx: ImportContext,
  batchId: string,
  source: "IBOW" | "ZEST",
  metrics: { yearMonth: string; unit: "HOMONKANGO" | "KYOTAKU"; metricKey: string; value: number }[],
  c: Counters,
  issues: Issue[],
) {
  const { db } = ctx;
  const closed = await closedMonths(db, ctx.origin);
  let held = 0;
  for (const m of metrics) {
    const where = { origin: ctx.origin, source, yearMonth: m.yearMonth, unit: m.unit, metricKey: m.metricKey } as const;
    const active = await db.metricValue.findFirst({ where: { ...where, state: "ACTIVE" } });
    if (active && active.value === m.value) {
      c.duplicateRows++;
      continue;
    }
    if (closed.has(m.yearMonth)) {
      const heldRows = await db.metricValue.findMany({ where: { ...where, state: "HELD" } });
      if (heldRows.some((h) => h.value === m.value)) {
        c.duplicateRows++;
        continue;
      }
      held++;
      await db.metricValue.create({ data: { ...where, batchId, value: m.value, state: "HELD" } });
      continue;
    }
    if (active) await db.metricValue.update({ where: { id: active.id }, data: { state: "SUPERSEDED" } });
    await db.metricValue.create({ data: { ...where, batchId, value: m.value, state: "ACTIVE" } });
    c.importedRows++;
    c.months.add(m.yearMonth);
  }
  if (held) {
    c.heldRows += held;
    issues.push({ severity: "WARNING", code: "CLOSED_MONTH", message: `確定済みの月の指標 ${held} 件は保留しました` });
  }
}

/** 確定解除後などに、保留（HELD）中の値を反映する */
export async function applyHeldValues(db: Db, yearMonth: string, userId: string | null) {
  const close = await db.monthClose.findUnique({ where: { yearMonth } });
  if (close?.status === "CLOSED") throw new Error("確定済みの月です。先に確定を解除してください");
  const heldFacts = await db.revenueFact.findMany({ where: { yearMonth, state: "HELD", origin: "REAL" }, orderBy: { createdAt: "asc" } });
  for (const f of heldFacts) {
    await db.$transaction([
      db.revenueFact.updateMany({ where: { origin: f.origin, source: f.source, unit: f.unit, yearMonth, state: "ACTIVE" }, data: { state: "SUPERSEDED" } }),
      db.revenueFact.update({ where: { id: f.id }, data: { state: "ACTIVE" } }),
    ]);
  }
  const heldTb = await db.trialBalanceLine.findMany({ where: { yearMonth, state: "HELD", origin: "REAL" }, orderBy: { createdAt: "asc" } });
  const byBatchSeg = new Map<string, typeof heldTb>();
  for (const l of heldTb) byBatchSeg.set(`${l.batchId}|${l.segment}`, [...(byBatchSeg.get(`${l.batchId}|${l.segment}`) ?? []), l]);
  for (const lines of byBatchSeg.values()) {
    const { origin, fiscalYear, segment } = lines[0];
    await db.$transaction([
      db.trialBalanceLine.updateMany({ where: { origin, fiscalYear, segment, yearMonth, state: "ACTIVE" }, data: { state: "SUPERSEDED" } }),
      db.trialBalanceLine.updateMany({ where: { id: { in: lines.map((l) => l.id) } }, data: { state: "ACTIVE" } }),
    ]);
  }
  const heldMetrics = await db.metricValue.findMany({ where: { yearMonth, state: "HELD", origin: "REAL" }, orderBy: { id: "asc" } });
  for (const m of heldMetrics) {
    await db.$transaction([
      db.metricValue.updateMany({ where: { origin: m.origin, source: m.source, unit: m.unit, yearMonth, metricKey: m.metricKey, state: "ACTIVE" }, data: { state: "SUPERSEDED" } }),
      db.metricValue.update({ where: { id: m.id }, data: { state: "ACTIVE" } }),
    ]);
  }
  await db.auditLog.create({ data: { userId, action: "HELD_APPLIED", target: yearMonth, detail: { revenue: heldFacts.length, trialBalance: heldTb.length, metrics: heldMetrics.length } } });
  await recalculate(db, { trigger: "MANUAL", origin: "REAL", months: [yearMonth] });
}
