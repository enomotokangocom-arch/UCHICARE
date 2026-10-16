// サンプルデータの投入（origin = SAMPLE）。すべて架空の数値。
// 実データと混ざらないよう、取込処理を origin=SAMPLE で実行し、ファイル名に【サンプル】を付ける。
// 使い方: npm run mos:seed-sample   （再投入する場合は --reset でサンプルデータを削除してから投入）
import "dotenv/config";
import { createHash } from "node:crypto";
import { createDb } from "../../src/mos/server/db";
import { importFile, importLoaded } from "../../src/mos/server/importService";
import { recalculate } from "../../src/mos/server/recalc";
import { seedMasters } from "../../src/mos/server/settings";
import { buildXlsx, kyotakuSheetRows } from "../../src/mos/testing/fixtures";

const db = createDb(process.env.DATABASE_URL!);
const ctx = { db, userId: null, origin: "SAMPLE" as const, hashSecret: process.env.MOS_HASH_SECRET ?? "sample", recalc: false };

// 決定的な疑似乱数（毎回同じサンプルになる）
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const around = (base: number, spread = 0.06) => Math.round((base * (1 + (rand() - 0.5) * 2 * spread)) / 100) * 100;

const MONTHS = ["2026-06", "2026-07", "2026-08"];
const fmt = (n: number) => n.toLocaleString("en-US");

function tbPages(): string[][] {
  const hk = MONTHS.map(() => ({ rev: around(12_000_000), ret: -around(300_000, 0.5), salary: around(7_000_000, 0.03), exec: 1_000_000, rent: 420_000, comm: around(250_000), car: around(300_000), fee: around(200_000, 0.3), soft: around(250_000, 0.1), tax: 150_000 }));
  const ky = MONTHS.map(() => ({ rev: around(950_000, 0.05), salary: around(760_000, 0.02), rent: 80_000 }));
  const line = (label: string, values: number[]) => {
    const all = [...values, ...Array(12 - values.length).fill(0), 0];
    return `${label.split("").join(" ")} ${all.map(fmt).join(" ")} ${fmt(values.reduce((a, b) => a + b, 0))}`;
  };
  const head = (seg: string) => [
    "令和 8年度 残 高 試 算 表 ( 年 間 推 移 ) 1 頁",
    seg,
    "【サンプル】架空の会社",
    "損益計算書",
    "単位： 円",
    "勘 定 科 目 6月度 7月度 8月度 9月度 10月度 11月度 12月度 1月度 2月度 3月度 4月度 5月度 決算仕訳合計 当期合計",
  ];
  const sum = (f: (i: number) => number) => MONTHS.map((_, i) => f(i));
  return [
    [
      ...head("事業所(合計)"),
      line("訪問看護事業収益", sum((i) => hk[i].rev)),
      line("居宅介護事業収益", sum((i) => ky[i].rev)),
      line("返戻等", sum((i) => hk[i].ret)),
      line("役員報酬", sum((i) => hk[i].exec)),
      line("給料手当", sum((i) => hk[i].salary + ky[i].salary)),
      line("法定福利費", sum((i) => Math.round((hk[i].salary + ky[i].salary) * 0.15))),
      line("地代家賃", sum((i) => hk[i].rent + ky[i].rent)),
      line("通信費", sum((i) => hk[i].comm)),
      line("車両費", sum((i) => hk[i].car)),
      line("支払手数料", sum((i) => hk[i].fee)),
      line("ソフト利用料", sum((i) => hk[i].soft)),
      line("支払報酬料", sum((i) => hk[i].tax)),
      line("支払利息", sum(() => 55_000)),
    ],
    [
      ...head("訪問看護"),
      line("訪問看護事業収益", sum((i) => hk[i].rev)),
      line("返戻等", sum((i) => hk[i].ret)),
      line("役員報酬", sum((i) => hk[i].exec)),
      line("給料手当", sum((i) => hk[i].salary)),
      line("法定福利費", sum((i) => Math.round((hk[i].salary + ky[i].salary) * 0.15) - Math.round(ky[i].salary * 0.15))),
      line("地代家賃", sum((i) => hk[i].rent)),
      line("通信費", sum((i) => hk[i].comm)),
      line("車両費", sum((i) => hk[i].car)),
      line("支払手数料", sum((i) => hk[i].fee)),
      line("ソフト利用料", sum((i) => hk[i].soft)),
      line("支払報酬料", sum((i) => hk[i].tax)),
      line("支払利息", sum(() => 55_000)),
    ],
    [
      ...head("居宅支援"),
      line("居宅介護事業収益", sum((i) => ky[i].rev)),
      line("給料手当", sum((i) => ky[i].salary)),
      line("法定福利費", sum((i) => Math.round(ky[i].salary * 0.15))),
      line("地代家賃", sum((i) => ky[i].rent)),
    ],
  ];
}

async function kyotakuWorkbook(tbPagesData: string[][]) {
  // 居宅の試算表売上と一致する月（照合済の例）と、少しずれる月（推計の例）を作る
  const kyRevenue = tbPagesData[2].find((l) => l.startsWith("居 宅 介 護 事 業 収 益"))!.split(" ").slice(-14, -11).map((v) => Number(v.replace(/,/g, "")));
  const sheets = [...MONTHS, "2026-09"].map((ym, i) => {
    const total = i < 3 ? kyRevenue[i] + (i === 1 ? 3_000 : 0) : around(980_000, 0.03);
    const support = 90_000;
    const commission = 18_000;
    const care = total - support - commission;
    const m = Number(ym.slice(5));
    const k = kyotakuSheetRows({ ymLabel: `令和8年${m}月`, care: [60, care - 30_000, 2, 30_000], support: [18, support, 0, 0], commission: [5, commission], certification: 0, newLayout: true });
    return { name: `${m}月`, rows: k.rows, merges: k.merges };
  });
  return buildXlsx(sheets);
}

function bankRows(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = (day: number) => `${y}${String(m).padStart(2, "0")}${String(day).padStart(2, "0")}`;
  let balance = 3_000_000;
  const rows: (string | number | null)[][] = [["日付", "摘要", "入金金額", "出金金額", "残高", "メモ"]];
  const tx: [number, string, number | null, number | null, string | null][] = [
    [1, "普通預金 利息", 12, null, null],
    [5, "Visaデビット利用 【サンプル】文具店 承認番号：000001 TID：000001", null, 3_300, "消耗品費"],
    [10, "振込 カ）ウチケア", 1_000_000, null, null],
    [12, "Visaデビット利用 【サンプル】喫茶店 承認番号：000002 TID：000002", null, 2_400, "会議費"],
    [15, "振込手数料", null, 145, null],
    [20, "Visaデビット利用 【サンプル】タクシー 承認番号：000003 TID：000003", null, 3_100, null],
    [25, "振込 【サンプル】フドウサン", null, 80_000, "家賃"],
    [26, "Visaデビット利用 【サンプル】不明な店 承認番号：000004 TID：000004", null, 5_500, null],
  ];
  for (const [day, desc, dep, wd, memo] of tx) {
    balance += (dep ?? 0) - (wd ?? 0);
    rows.push([d(day), desc, dep, wd, balance, memo]);
  }
  // GMO の明細は日付の降順
  return [rows[0], ...rows.slice(1).reverse()];
}

function sendaiRows(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const acct = "サンプル支店（000） 普通 0000000";
  const date = (day: number) => `${m}/${day}/${y}`;
  let balance = 20_000_000;
  const out: (string | number | null)[][] = [
    ["照会口座", "番号", "勘定日", "（起算日）", "出金金額（円）", "入金金額（円）", "小切手区分", "残高（円）", "取引区分", "明細区分", "金融機関名", "支店名", "摘要", null],
  ];
  const tx: [number, string, number | null, number | null][] = [
    [7, "ﾐﾔｷﾞｹﾝｺｸﾎﾚﾝ", null, 9_000_000],
    [10, "ATMﾌﾘｺﾐ", 1_000_000, null],
    [10, "ｱﾒﾂｸｽ", 350_000, null],
    [17, "ﾍﾝｻｲｷﾝ", 150_000, null],
    [18, "ｷﾕｳﾌﾘｼｷﾝ", 6_500_000, null],
    [25, "KDDIﾘﾖｳｷﾝ", 12_000, null],
    [27, "SMBC(ｻﾝﾌﾟﾙｼﾖｳｼﾞ", 24_000, null],
    [30, "ｺｸｾﾞｲｼﾔﾎ", 2_800_000, null],
  ];
  const seqByDay = new Map<number, number>();
  for (const [day, desc, wd, dep] of tx) {
    balance += (dep ?? 0) - (wd ?? 0);
    const seq = (seqByDay.get(day) ?? 0) + 1;
    seqByDay.set(day, seq);
    out.push([acct, seq, date(day), null, wd ? fmt(wd) : null, dep ? fmt(dep) : null, null, fmt(balance), wd ? "出金" : "振込", null, null, null, desc, null]);
  }
  return out;
}

async function main() {
  if (process.argv.includes("--reset")) {
    await db.$transaction([
      db.bankTransaction.deleteMany({ where: { origin: "SAMPLE" } }),
      db.revenueFact.deleteMany({ where: { origin: "SAMPLE" } }),
      db.trialBalanceLine.deleteMany({ where: { origin: "SAMPLE" } }),
      db.visitRecord.deleteMany({ where: { origin: "SAMPLE" } }),
      db.metricValue.deleteMany({ where: { origin: "SAMPLE" } }),
      db.monthlySnapshot.deleteMany({ where: { origin: "SAMPLE" } }),
      db.importBatch.deleteMany({ where: { origin: "SAMPLE" } }),
    ]);
    console.log("サンプルデータを削除しました");
  }
  await seedMasters(db);

  const pages = tbPages();
  const r1 = await importLoaded(ctx, "【サンプル】残高試算表(年間推移)部門別含む.pdf", new TextEncoder().encode(JSON.stringify(pages)), async () => ({ kind: "pdf", pages }));
  console.log("試算表", r1.status);
  console.log("居宅売上管理表", (await importFile(ctx, "【サンプル】居宅売上管理表.xlsx", await kyotakuWorkbook(pages))).status);
  for (const ym of ["2026-08", "2026-09"]) {
    const g = await importFile(ctx, `【サンプル】${Number(ym.slice(5))}月GMO.xlsx`, await buildXlsx([{ name: "statement-000-0-0000000", rows: bankRows(ym) }]));
    const s = await importFile(ctx, `【サンプル】${Number(ym.slice(5))}月仙台銀行.xlsx`, await buildXlsx([{ name: "sample", rows: sendaiRows(ym) }]));
    console.log(ym, "銀行明細", g.status, s.status);
  }

  // 訪問記録（iBow 実施実績・ZEST 予定）: 架空の職員・利用者キー
  const batch = await db.importBatch.create({
    data: { fileName: "【サンプル】訪問記録（自動生成）", fileSize: 0, sha256: "sample-visits", sourceType: "IBOW_IMPLEMENTATION_XLSX", detectedBy: "sample", origin: "SAMPLE", status: "SUCCEEDED", finishedAt: new Date() },
  });
  const rows = [];
  const staff = [
    ...Array.from({ length: 8 }, (_, i) => ({ key: `n${i}`, job: "NURSE" as const })),
    ...Array.from({ length: 3 }, (_, i) => ({ key: `p${i}`, job: "PT" as const })),
    { key: "o0", job: "OT" as const },
  ];
  for (const ym of [...MONTHS, "2026-09"]) {
    const [y, m] = ym.split("-").map(Number);
    for (let day = 1; day <= 28; day++) {
      const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
      if (dow === 0) continue;
      for (const s of staff) {
        const visits = dow === 6 ? 1 : 4;
        for (let v = 0; v < visits; v++) {
          const subject = `u${Math.floor(rand() * 120)}`;
          const cancelled = rand() < 0.03;
          for (const [source, kind] of [["IBOW", "ACTUAL"], ["ZEST", "SCHEDULED"]] as const) {
            if (source === "IBOW" && rand() < 0.02) continue; // 予定はあったが実績なし
            rows.push({
              batchId: batch.id,
              origin: "SAMPLE" as const,
              source,
              kind,
              visitDate: new Date(Date.UTC(y, m - 1, day)),
              yearMonth: ym,
              unit: "HOMONKANGO" as const,
              staffKey: createHash("sha256").update(s.key).digest("hex").slice(0, 32),
              jobType: s.job,
              subjectKey: createHash("sha256").update(subject).digest("hex").slice(0, 32),
              minutes: [30, 60, 60, 90][Math.floor(rand() * 4)],
              cancelled,
              fingerprint: createHash("sha256").update(`sample|${source}|${ym}|${day}|${s.key}|${v}`).digest("hex"),
            });
          }
        }
      }
    }
  }
  await db.visitRecord.createMany({ data: rows, skipDuplicates: true });
  console.log("訪問記録", rows.length, "件");

  await recalculate(db, { trigger: "MANUAL", origin: "SAMPLE" });
  console.log("再計算しました");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
