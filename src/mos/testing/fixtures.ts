// テスト用フィクスチャ。実ファイルで確認した「構造」だけを再現した合成データ（実在の金額・氏名・口座番号は使わない）。
import ExcelJS from "exceljs";

type CellInput = string | number | Date | null;

export async function buildXlsx(sheets: { name: string; rows: CellInput[][]; merges?: string[] }[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name);
    s.rows.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v !== null && v !== undefined) ws.getCell(r + 1, c + 1).value = v;
      }),
    );
    for (const m of s.merges ?? []) ws.mergeCells(m);
  }
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

/** GMO 明細（日付降順・YYYYMMDD・メモ列あり） */
export function gmoRows(): CellInput[][] {
  return [
    ["日付", "摘要", "入金金額", "出金金額", "残高", "メモ"],
    ["20260831", "振込手数料", null, 100, 500000, null],
    ["20260831", "振込 シチジユウシチ ト－ホクガス．カ", null, 2000, 500100, null],
    ["20260828", "Visaデビット利用 アスクル 承認番号：111111 TID：222222", null, 1500, 502100, "名刺"],
    ["20260828", "Visaデビット利用 コメダ珈琲店 承認番号：333333 TID：444444", null, 1200, 503600, "会議費"],
    ["20260827", "振込 センダイ カ）テストフドウサン", null, 80000, 504800, "家賃"],
    ["20260810", "振込 カ）ウチケア", 1000000, null, 584800, null],
    ["20260801", "普通預金 利息", 10, null, 4800, null],
  ];
}

/** 仙台銀行明細（勘定日昇順・M/D/YYYY・摘要の右に見出し空欄のメモ列） */
export function sendaiRows(): CellInput[][] {
  const acct = "テスト支店（999） 普通 0001234";
  const h = ["照会口座", "番号", "勘定日", "（起算日）", "出金金額（円）", "入金金額（円）", "小切手区分", "残高（円）", "取引区分", "明細区分", "金融機関名", "支店名", "摘要", null];
  return [
    h,
    [acct, 1, "8/3/2026", null, "50,000", null, null, "9,950,000", "出金", null, null, null, "ｾｿﾞﾝ)ﾘ-ｽ", null],
    [acct, 1, "8/7/2026", null, null, "700,000", null, "10,650,000", "振込", null, "77", "ｹﾝﾁﾖｳ", "ﾐﾔｷﾞｹﾝｺｸﾎﾚﾝ", null],
    [acct, 1, "8/10/2026", null, "1,000,000", null, null, "9,650,000", "出金", null, null, null, "ATMﾌﾘｺﾐ", null],
    [acct, 2, "8/10/2026", null, null, "3,000", null, "9,653,000", "入金", null, null, null, null, null],
    [acct, 3, "8/10/2026", null, "300,000", null, null, "9,353,000", "出金", null, null, null, "ｱﾒﾂｸｽ", "PC"],
    [acct, 1, "8/17/2026", null, "100,000", null, null, "9,253,000", "出金", null, null, null, "ﾍﾝｻｲｷﾝ 8ｶﾞﾂ", null],
    [acct, 1, "8/18/2026", null, "5,000,000", null, null, "4,253,000", "出金", null, null, null, "ｷﾕｳﾌﾘｼｷﾝ", null],
    [acct, 1, "8/27/2026", null, "20,000", null, null, "4,233,000", "出金", null, null, null, "SMBC(ﾃｽﾄｼﾖｳｼﾞ", null],
    [acct, 2, "8/27/2026", null, "20,000", null, null, "4,213,000", "出金", null, null, null, "SMBC(ﾃｽﾄｼﾖｳｼﾞ", null],
  ];
}

type KyotakuMonthInput = {
  ymLabel: string;
  care: [number, number, number, number]; // 今月件数, 今月金額, 月後れ件数, 月後れ金額
  support: [number, number, number, number];
  commission?: [number, number];
  certification?: number;
  totalOverride?: number;
  newLayout?: boolean;
};

/**
 * 居宅売上管理表の月シート。
 * 旧版: 単価 | 今月(件数,金額) | 月後れ(件数,金額) | 合計(件数,金額)
 * 新版（令和8年6月〜）: 月後れの前に「月後れ単価」列が1列増える
 */
export function kyotakuSheetRows(m: KyotakuMonthInput): { rows: CellInput[][]; merges: string[] } {
  const sum = (a: number[]) => [a[0], a[1], a[2], a[3], a[0] + a[2], a[1] + a[3]];
  const careVals = sum(m.care);
  const supportVals = sum(m.support);
  const total =
    m.totalOverride ?? careVals[5] + supportVals[5] + (m.commission?.[1] ?? 0) + (m.certification ?? 0);
  const L = m.newLayout ? 1 : 0; // 追加列の数
  const yearlyCol = 10 + L;
  const row = (label: string, nums: (number | null)[], unitPrice: number | null = null): CellInput[] => {
    const r: CellInput[] = [null, label, unitPrice];
    // 今月(件数,金額)
    r.push(nums[0] ?? null, nums[1] ?? null);
    if (L) r.push(null); // 月後れ単価
    r.push(nums[2] ?? null, nums[3] ?? null, nums[4] ?? null, nums[5] ?? null);
    while (r.length < yearlyCol) r.push(null);
    return r;
  };
  const header1: CellInput[] = [null, "月間売上表"];
  while (header1.length < yearlyCol) header1.push(null);
  header1.push("年間売上表");
  const header2: CellInput[] = [null, m.ymLabel, null, null, null, null, null, "総売上", total];
  while (header2.length < yearlyCol) header2.push(null);
  header2.push(null, null, null, null, null, null, null, "総売上", 99999999);
  const header3: CellInput[] = [null, null, "単価", null, "今月請求", null];
  if (L) header3.push(null);
  header3.push("月後れ請求", null, "合計");
  while (header3.length < yearlyCol) header3.push(null);
  header3.push(null, null, null, "要介護", null, "要支援", null, "委託", "合計");

  const rows: CellInput[][] = [
    header1,
    header2,
    header3,
    row("要介護", careVals),
    row("居宅介護支援費", [m.care[0], m.care[1], m.care[2], m.care[3], m.care[0] + m.care[2], m.care[1] + m.care[3]], 10000),
    row("加算/減算", [null, 0, null, 0, 0, 0]),
    row("要支援", supportVals),
    row("介護予防支援費", [m.support[0], m.support[1], null, 0, m.support[0], m.support[1]], 5000),
    row("委託連携", [null, 0, null, 0, 0, 0]),
  ];
  if (m.commission) {
    const r: CellInput[] = [null, "委託"];
    while (r.length < 7 + L) r.push(null);
    r.push(m.commission[0], m.commission[1]);
    while (r.length < yearlyCol) r.push(null);
    rows.push(r);
  }
  if (m.certification !== undefined) rows.push(row("認定調査", [null, 0, null, 0, 0, m.certification]));
  // 右ブロック（年間売上表）の行。左ブロックの読み取りに影響しないことを確認するため値を入れる
  rows[4].push(null, "1月", 1, 1000, 1, 1000, 0, 0, 2000);
  // 結合セル: 見出し（今月請求）と「要介護」ラベル（B:C）。exceljs は従属セルにも値を複製するため、
  // 従属セルを空として扱えていないと数値の並びが崩れる
  const col = (i: number) => String.fromCharCode(65 + i);
  const merges = [`${col(4)}3:${col(5)}3`, "B4:C4"];
  return { rows, merges };
}

/** 試算表 PDF のテキスト行（部門別3頁分）。金額は合成値 */
export function trialBalancePages(opts?: { brokenTotal?: boolean; kyotakuRent?: number }): string[][] {
  const months = "6月度 7月度 8月度 9月度 10月度 11月度 12月度 1月度 2月度 3月度 4月度 5月度 決算仕訳合計 当期合計";
  const fmt = (n: number) => n.toLocaleString("en-US");
  const line = (label: string, jun: number, jul: number, aug: number, totalAdj = 0) =>
    `${label.split("").join(" ")} ${[jun, jul, aug, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map(fmt).join(" ")} ${fmt(jun + jul + aug + totalAdj)}`;
  const page = (seg: string, rows: string[]) => [
    "令和 8年度 残 高 試 算 表 ( 年 間 推 移 ) 1 頁",
    seg,
    "株式会社テスト",
    "損益計算書",
    "単位： 円",
    `勘 定 科 目 ${months}`,
    ...rows,
    "作成者：テスト会計事務所",
  ];
  const rent = opts?.kyotakuRent ?? 80000;
  return [
    page("事業所(合計)", [
      line("訪問看護事業収益", 10000000, 11000000, 12000000),
      line("居宅介護事業収益", 800000, 850000, 900000),
      line("返戻等", -100000, -50000, -20000),
      line("売上高合計", 10700000, 11800000, 12880000),
      line("役員報酬", 1000000, 1000000, 1000000),
      line("給料手当", 6000000, 6100000, 6200000, opts?.brokenTotal ? 1 : 0),
      line("地代家賃", 500000, 500000, 500000),
      line("通信費", 200000, 200000, 200000),
      line("販売管理費計", 7700000, 7800000, 7900000),
      line("営業損益金額", 3000000, 4000000, 4980000),
      line("支払利息", 50000, 50000, 50000),
    ]),
    page("訪問看護", [
      line("訪問看護事業収益", 10000000, 11000000, 12000000),
      line("返戻等", -100000, -50000, -20000),
      line("売上高合計", 9900000, 10950000, 11980000),
      line("役員報酬", 1000000, 1000000, 1000000),
      line("給料手当", 5300000, 5400000, 5500000),
      line("地代家賃", 500000 - rent, 500000 - rent, 500000 - rent),
      line("通信費", 200000, 200000, 200000),
      line("支払利息", 50000, 50000, 50000),
    ]),
    page("居宅支援", [
      line("居宅介護事業収益", 800000, 850000, 900000),
      line("売上高合計", 800000, 850000, 900000),
      line("給料手当", 700000, 700000, 700000),
      line("地代家賃", rent, rent, rent),
    ]),
  ];
}

/** iBow 実施報告書（1〜3行目は空、4行目が見出し）。個人情報列には架空の値を入れ、取込まれないことを確認する */
export function ibowImplementationRows(): CellInput[][] {
  const header = ["訪問日", "ID", "要介護度", "年齢", "訪問種別", "指示種類", "開始時間", "終了時間", "提供時間", "サービス内容", "主訪問者", "副訪問者①", "利用者の住所", "同日の訪問回数"];
  const row = (d: string, id: string, kind: string, start: string, end: string, min: string | null, staff: string) =>
    [d, id, "要介護１", "85", kind, "訪問看護", min ? start : null, min ? end : null, min, "テストサービス", staff, null, "架空市架空町1-2-3", "1"];
  return [
    [],
    [],
    [],
    header,
    row("2026-09-01", "9001", "介護", "9:00", "10:00", "60", "架空　看護師A"),
    row("2026-09-01", "9001", "介護", "14:00", "15:00", "60", "架空　看護師A"),
    row("2026-09-01", "9002", "医療", "10:30", "11:30", "60", "架空　療法士B"),
    row("2026-09-02", "9003", "予防", "9:00", "9:40", "40", "架空　療法士B"),
    row("2026-09-02", "9004", "サ(自)", "13:00", "14:00", "60", "架空　看護師A"),
    row("2026-09-03", "9002", "医療", "", "", null, "架空　看護師A"),
  ];
}

/** ZEST dashboard-経営指標.zip の CSV（見出しは実ファイルと同じ。数値は架空） */
export function zestCsvFiles(days = { weekday: 21, holiday: 10 }): Record<string, string> {
  return {
    "dashboard-経営指標/訪問件数.csv": '日別 x 職員の予定(サービスプラン・緊急) 訪問件数_対象期間,前期間比較\n"1,500",5.0%\n',
    "dashboard-経営指標/訪問時間.csv": '日別 x 職員の予定(サービスプラン・緊急) 訪問時間_対象期間,前期間比較\n"1,200.5",1.0%\n',
    "dashboard-経営指標/利用者数.csv": "日別 x 訪問利用者(サービスプラン・緊急) 利用者数_対象期間,前期間比較\n250,2.0%\n",
    "dashboard-経営指標/新規数.csv": "日別 x 訪問利用者(サービスプラン・緊急) 初回訪問利用者数_対象期間,前期間比較\n10,1.0%\n",
    "dashboard-経営指標/ターミナルケア利用者数.csv": "日別 x 訪問利用者(サービスプラン・緊急) ターミナルケア利用者数_対象期間,前期間比較\n0,\n",
    "dashboard-経営指標/キャンセル数.csv": "キャンセル理由 キャンセル数_対象期間,前期間比較\n100,-10.0%\n",
    "dashboard-経営指標/常勤換算.csv": "年間カレンダー 常勤換算用結合Key,常勤換算_対象期間,前期間比較\njoin_key,15.5,1.0%\n",
    "dashboard-経営指標/稼働率（_）_.csv": "先頭職種,稼働率\n理学療法士,40.0%\n正看護師,35.5%\n事務,0.0%\n",
    "dashboard-経営指標/キャンセル理由.csv": "キャンセル理由 キャンセル理由,キャンセル理由 キャンセル数\n祝日,40\n入院,60\n",
    "dashboard-経営指標/平日・休日比較.csv": `平日/休日,日数,訪問件数/日,訪問時間/日,平均稼働人数,1日の訪問件数/人\n平日,${days.weekday},70.0,50.0,15.0,4.5\n休日,${days.holiday},2.0,1.0,0.0,\n`,
    "dashboard-経営指標/曜日別　訪問状況.csv": "曜日,訪問件数,訪問時間,移動時間\n月曜日,1,1,1\n",
  };
}

/** iBow SalesList.csv（1〜2行目に事業所名・提供月、3行目が見出し、最終行が合計行）。数値・IDは架空 */
export function salesListCsv(opts?: { brokenTotal?: boolean; month?: string }): string {
  const header = ["利用者ID", "医療提供回数", "医療総金額", "医療給付割合", "医療自己負担額", "在宅がん医療総合診療料金額", "医療公費番号1", "医療公費番号2", "介護提供回数", "介護総単位数", "介護総金額", "介護給付割合", "介護自己負担単位数", "介護自己負担額", "介護公費番号1", "介護公費番号2", "予防提供回数", "予防総単位数", "予防総金額", "予防給付割合", "予防自己負担単位数", "予防自己負担額", "予防公費番号1", "予防公費番号2", "定期巡回提供回数", "定期巡回総単位数", "定期巡回総金額", "定期巡回給付割合", "定期巡回自己負担単位数", "定期巡回自己負担額", "定期巡回公費番号1", "定期巡回公費番号2", "サービス提供回数"];
  const empty = () => Array(header.length).fill("");
  const row = (id: string, med: [number, number, number] | null, care: [number, number, number] | null, prev: [number, number, number] | null, kohi = "") => {
    const r = empty();
    r[0] = id;
    if (med) [r[1], r[2], r[3], r[4], r[5], r[6]] = [String(med[0]), String(med[1]), "7割", String(med[2]), "0", kohi];
    if (care) [r[8], r[9], r[10], r[11], r[12], r[13]] = [String(care[0]), "1000", String(care[1]), "90%", "100", String(care[2])];
    if (prev) [r[16], r[17], r[18], r[19], r[20], r[21]] = [String(prev[0]), "500", String(prev[1]), "90%", "50", String(prev[2])];
    return r;
  };
  const rows = [
    row("9001", [5, 50000, 15000], null, null, "54"),
    row("9002", null, [8, 80000, 8000], null),
    row("9003", [2, 20000, 6000], [4, 40000, 4000], null),
    row("9004", null, null, [3, 30000, 3000]),
  ];
  const total = empty();
  [total[1], total[2], total[4], total[5]] = ["7", String(70000 + (opts?.brokenTotal ? 1 : 0)), "21000", "0"];
  [total[8], total[10], total[13]] = ["12", "120000", "12000"];
  [total[16], total[18], total[21]] = ["3", "30000", "3000"];
  total[32] = "";
  const lines = [
    ["ステーション名：テスト訪問看護ステーション", ...Array(header.length - 1).fill("")],
    [`提供月：${opts?.month ?? "2026年09月度"}`, ...Array(header.length - 1).fill("")],
    header,
    ...rows,
    total,
  ];
  return lines.map((l) => l.join(",")).join("\r\n") + "\r\n";
}
