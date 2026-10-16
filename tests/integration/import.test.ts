import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { strToU8 } from "fflate";
import { buildXlsx, gmoRows, kyotakuSheetRows, sendaiRows, trialBalancePages } from "@/mos/testing/fixtures";
import { applyHeldValues, confirmMappingAndImport, importFile, importLoaded } from "@/mos/server/importService";
import { closeMonth, recalculate, reopenMonth, type SnapshotData } from "@/mos/server/recalc";
import { ctx, createUser, hasTestDb, resetDb, testDb } from "./helpers";

const d = hasTestDb ? testDb() : (null as never);

async function kyotakuFile(careAmount: number) {
  const k = kyotakuSheetRows({ ymLabel: "令和8年8月", care: [30, careAmount, 0, 0], support: [10, 50000, 0, 0], commission: [2, 7000], certification: 0, newLayout: true });
  return buildXlsx([{ name: "8月", rows: k.rows, merges: k.merges }]);
}

async function importTb(userId: string | null, pages = trialBalancePages()) {
  // PDF テキスト抽出は pdfText.test.ts で検証済み。ここでは抽出後の行を渡す
  const data = strToU8(JSON.stringify(pages));
  return importLoaded(ctx(d, userId), "株式会社テスト_残高試算表(年間推移)部門別含む.pdf", data, async () => ({ kind: "pdf", pages }));
}

async function snapshot(yearMonth: string) {
  const s = await d.monthlySnapshot.findUnique({ where: { origin_yearMonth_unit: { origin: "REAL", yearMonth, unit: "COMPANY" } } });
  return s ? { ...s, data: s.data as unknown as SnapshotData } : null;
}

describe.skipIf(!hasTestDb)("取込サービス（DB統合）", () => {
  beforeEach(async () => {
    await resetDb(d);
  });
  afterAll(async () => {
    await d?.$disconnect();
  });

  it("銀行明細を取込み、自動分類し、別ファイル間の口座間振替を照合する", async () => {
    const sendai = await importFile(ctx(d), "8月仙台銀行.xlsx", await buildXlsx([{ name: "8月仙台銀行", rows: sendaiRows() }]));
    const gmo = await importFile(ctx(d), "8月GMO.xlsx", await buildXlsx([{ name: "statement-101-1-0000001", rows: gmoRows() }]));
    expect(sendai.status).toBe("SUCCEEDED");
    expect(gmo.status).toBe("SUCCEEDED");
    const txs = await d.bankTransaction.findMany();
    expect(txs).toHaveLength(16);
    const atm = txs.find((t) => t.description === "ATMフリコミ")!;
    const own = txs.find((t) => t.description === "振込 カ)ウチケア")!;
    expect(atm.category).toBe("INTERNAL_TRANSFER");
    expect(atm.transferPairId).toBeTruthy();
    expect(own.transferPairId).toBe(atm.transferPairId);
    expect(txs.find((t) => t.description === "アメツクス")!.category).toBe("CARD_SETTLEMENT");
    // 同日・同額・同摘要の2件（残高違い）は別の取引として残る
    expect(txs.filter((t) => t.description === "SMBC(テストシヨウジ")).toHaveLength(2);
    // 口座番号はそのまま保存しない
    const accounts = await d.bankAccount.findMany();
    expect(accounts.map((a) => a.last4).sort()).toEqual(["0001", "1234"]);
    expect(JSON.stringify(accounts)).not.toContain("0001234");
  });

  it("同じファイルの再取込は DUPLICATE、期間が重なるファイルは新しい行だけ取込む", async () => {
    const file = await buildXlsx([{ name: "8月仙台銀行", rows: sendaiRows() }]);
    await importFile(ctx(d), "8月仙台銀行.xlsx", file);
    const again = await importFile(ctx(d), "8月仙台銀行 (1).xlsx", file);
    expect(again.status).toBe("DUPLICATE");
    expect(await d.bankTransaction.count()).toBe(9);

    const rows = sendaiRows();
    rows.push(["テスト支店（999） 普通 0001234", 1, "8/31/2026", null, "1,000", null, null, "4,212,000", "出金", null, null, null, "ﾃｽﾄ", null]);
    const overlap = await importFile(ctx(d), "8月仙台銀行_追加.xlsx", await buildXlsx([{ name: "x", rows }]));
    expect(overlap.status).toBe("SUCCEEDED");
    const batch = await d.importBatch.findUniqueOrThrow({ where: { id: overlap.batchId } });
    expect(batch).toMatchObject({ importedRows: 1, duplicateRows: 9, totalRows: 10 });
    expect(await d.bankTransaction.count()).toBe(10);
  });

  it("エラー行はエラーログに残し、他の行は取込む（PARTIAL）", async () => {
    const rows = sendaiRows();
    rows.push(["テスト支店（999） 普通 0001234", 1, "2026年8月31日?", null, "1,000", null, null, "1", "出金", null, null, null, "ﾃｽﾄ", null]);
    const r = await importFile(ctx(d), "仙台銀行.xlsx", await buildXlsx([{ name: "x", rows }]));
    expect(r.status).toBe("PARTIAL");
    const issues = await d.importIssue.findMany({ where: { batchId: r.batchId, severity: "ERROR" } });
    expect(issues).toEqual([expect.objectContaining({ code: "INVALID_DATE", rowNumber: 11, column: "勘定日" })]);
  });

  it("判別できないファイルは FAILED として履歴に残す", async () => {
    const r = await importFile(ctx(d), "memo.csv", strToU8("a,b\n1,2\n"));
    expect(r.status).toBe("FAILED");
    expect((await d.importIssue.findFirstOrThrow({ where: { batchId: r.batchId } })).code).toBe("TYPE_UNKNOWN");
  });

  it("試算表と居宅売上管理表を取込み、照合済み・推計を判定してスナップショットを作る", async () => {
    await importTb(null);
    expect(await d.trialBalanceLine.count({ where: { yearMonth: "2026-09" } })).toBe(0); // 未計上の月は保存しない
    let s = await snapshot("2026-08");
    expect(s!.data.pl.basis).toBe("TRIAL_BALANCE");
    expect(s!.data.pl.units.KYOTAKU.revenueStatus).toBe("ESTIMATED");

    // 居宅売上管理表の総売上 = 試算表の居宅介護事業収益（900,000）
    await importFile(ctx(d), "居宅売上管理表.xlsx", await kyotakuFile(843000));
    s = await snapshot("2026-08");
    expect(s!.data.pl.units.KYOTAKU.revenueStatus).toBe("RECONCILED");
    expect(s!.data.kpi.users.kyotaku).toBe(40);
    expect(s!.valueStatus).toBe("ESTIMATED"); // 訪問看護は iBow 未取込のため全社は推計のまま
  });

  it("確定月は書き換えない: 新しい値は保留し、確定解除＋反映で初めて使う", async () => {
    const admin = await createUser(d);
    await importTb(admin.id);
    await importFile(ctx(d, admin.id), "居宅売上管理表.xlsx", await kyotakuFile(843000));
    await closeMonth(d, "2026-08", admin.id);
    const closed = await snapshot("2026-08");
    expect(closed!.valueStatus).toBe("FINAL");
    expect(closed!.frozen).toBe(true);

    // 確定後に値の違うファイル → HELD（計算に使わない）
    const r = await importFile(ctx(d, admin.id), "居宅売上管理表_修正.xlsx", await kyotakuFile(853000));
    const batch = await d.importBatch.findUniqueOrThrow({ where: { id: r.batchId } });
    expect(batch.heldRows).toBe(1);
    expect(await d.revenueFact.count({ where: { state: "HELD" } })).toBe(1);
    // 試算表の差し替えも保留
    await importTb(admin.id, trialBalancePages({ kyotakuRent: 90000 }));
    expect(await d.trialBalanceLine.count({ where: { state: "HELD", yearMonth: "2026-08" } })).toBeGreaterThan(0);
    // 銀行明細も確定月分は取込まない
    const bank = await importFile(ctx(d, admin.id), "8月仙台銀行.xlsx", await buildXlsx([{ name: "x", rows: sendaiRows() }]));
    expect((await d.importBatch.findUniqueOrThrow({ where: { id: bank.batchId } })).heldRows).toBe(9);

    await recalculate(d, { trigger: "CRON" });
    const after = await snapshot("2026-08");
    expect(after!.computedAt).toEqual(closed!.computedAt);
    expect(after!.data).toEqual(closed!.data);

    await expect(applyHeldValues(d, "2026-08", admin.id)).rejects.toThrow("確定済み");
    await expect(reopenMonth(d, "2026-08", admin.id, "")).rejects.toThrow("理由");
    await reopenMonth(d, "2026-08", admin.id, "会計事務所の修正を反映");
    await applyHeldValues(d, "2026-08", admin.id);
    const reopened = await snapshot("2026-08");
    expect(reopened!.data.pl.reconciliation.revenue.find((x) => x.unit === "KYOTAKU")!.operational).toBe(853000 + 50000 + 7000);
    expect(reopened!.data.pl.units.KYOTAKU.directCost).toBe(700000 + 90000);
    const audits = (await d.auditLog.findMany()).map((a) => a.action);
    expect(audits).toEqual(expect.arrayContaining(["MONTH_CLOSED", "MONTH_REOPENED", "HELD_APPLIED"]));
  });

  it("確定前の値の差し替えは旧版を SUPERSEDED にして履歴を残す", async () => {
    await importFile(ctx(d), "居宅売上管理表.xlsx", await kyotakuFile(843000));
    await importFile(ctx(d), "居宅売上管理表 (2).xlsx", await kyotakuFile(844000));
    const facts = await d.revenueFact.findMany({ orderBy: { createdAt: "asc" } });
    expect(facts.map((f) => f.state)).toEqual(["SUPERSEDED", "ACTIVE"]);
  });

  it("列仕様未確認のファイルは列マッピング待ちになり、確定後に取込まれ、元ファイルは消去される", async () => {
    const admin = await createUser(d);
    const csv = "請求年月,利用者氏名,請求額\n2026/08,テスト 太郎,10000\n2026/08,テスト 花子,20000\n";
    const r = await importFile(ctx(d, admin.id), "SalesList.csv", strToU8(csv));
    expect(r.status).toBe("NEEDS_MAPPING");
    const batch = await d.importBatch.findUniqueOrThrow({ where: { id: r.batchId } });
    expect(batch.rawFile).not.toBeNull();
    expect(JSON.stringify(batch.headerInfo)).not.toContain("テスト 太郎");

    const bad = await confirmMappingAndImport(ctx(d, admin.id), r.batchId, { purpose: "SALES", fields: { 請求年月: "yearMonth", 利用者氏名: "amount" }, valueMaps: {} }, null);
    expect(bad.ok).toBe(false);

    const ok = await confirmMappingAndImport(ctx(d, admin.id), r.batchId, { purpose: "SALES", fields: { 請求年月: "yearMonth", 請求額: "amount" }, valueMaps: {} }, "SalesList 確定");
    expect(ok).toEqual({ ok: true, status: "SUCCEEDED" });
    const done = await d.importBatch.findUniqueOrThrow({ where: { id: r.batchId } });
    expect(done.rawFile).toBeNull();
    expect(await d.revenueFact.findFirst({ where: { source: "IBOW_SALES" } })).toMatchObject({ unit: "HOMONKANGO", yearMonth: "2026-08", amount: 30000 });

    // 同じ列構成の次のファイルには確定済みマッピングが自動適用される
    const next = await importFile(ctx(d, admin.id), "SalesList (1).csv", strToU8("請求年月,利用者氏名,請求額\n2026/09,テスト 次郎,5000\n"));
    expect(next.status).toBe("SUCCEEDED");
    expect(await d.revenueFact.count({ where: { source: "IBOW_SALES", state: "ACTIVE" } })).toBe(2);
  });

  it("再計算は未確定月だけを対象にし、実行履歴を残す", async () => {
    await importFile(ctx(d, null, false), "居宅売上管理表.xlsx", await kyotakuFile(843000));
    const r = await recalculate(d, { trigger: "CRON" });
    expect(r.months).toBe(1);
    const run = await d.recalcRun.findUniqueOrThrow({ where: { id: r.runId } });
    expect(run).toMatchObject({ status: "SUCCEEDED", trigger: "CRON" });
    const s = await snapshot("2026-08");
    expect(s!.data.pl.basis).toBe("ESTIMATE");
    expect(s!.data.pl.company.revenue).toBeNull(); // 訪問看護の売上データがないため全社売上は出さない
  });
});
