/**
 * iBow「訪問件数詳細表(職員別)」(Excel)から、件数×報酬単価で売上を概算する。
 * 加算・減算・利用者負担の区別は含まない「基本報酬ベースの概算」。
 */
import { FeeRate } from "./types";

export const normalizeCode = (s: string) => s.normalize("NFKC").replace(/\s/g, "");
export const feeKey = (group: string, code: string) => `${normalizeCode(group)}|${normalizeCode(code)}`;

function rate(group: string, code: string, kind: FeeRate["kind"], value: number, note = "", bracketMode?: FeeRate["bracketMode"]): FeeRate {
  const key = feeKey(group, code);
  // 医療・精神は [n] を「基本療養費が発生しない回数」として差し引く
  const mode = bracketMode ?? (group === "医療" || group === "精神" ? "exclude" : "none");
  return { id: key, key, group, code, kind, value, bracketMode: mode, note };
}

/**
 * 報酬単価の初期値(2024年度改定の基本報酬。訪問看護ステーション)。
 * 実際の算定(加算・減算、機能強化型の管理療養費など)に合わせて「設定・マスタ」で修正する。
 */
export const DEFAULT_FEE_RATES: FeeRate[] = [
  rate("介護", "訪看Ⅰ1", "単位", 314, "20分未満"),
  rate("介護", "訪看Ⅰ2", "単位", 471, "30分未満"),
  rate("介護", "訪看Ⅰ3", "単位", 823, "30分以上1時間未満"),
  rate("介護", "訪看Ⅰ4", "単位", 1128, "1時間以上1時間30分未満"),
  rate("介護", "訪看Ⅰ5", "単位", 294, "理学療法士等 1回(20分)ごと。[ ]の請求回数で計算", "billing"),
  rate("介護", "訪看Ⅰ52超", "単位", 265, "理学療法士等 1日2回超(90/100)。[ ]の請求回数で計算", "billing"),
  rate("予防", "訪看Ⅰ1", "単位", 303, "20分未満"),
  rate("予防", "訪看Ⅰ2", "単位", 451, "30分未満"),
  rate("予防", "訪看Ⅰ3", "単位", 794, "30分以上1時間未満"),
  rate("予防", "訪看Ⅰ4", "単位", 1090, "1時間以上1時間30分未満"),
  rate("予防", "訪看Ⅰ5", "単位", 284, "理学療法士等 1回(20分)ごと。[ ]の請求回数で計算", "billing"),
  rate("予防", "訪看Ⅰ52超", "単位", 142, "理学療法士等 1日2回超(50/100)。[ ]の請求回数で計算", "billing"),
  rate("管理", "管理(初)", "円", 7670, "訪問看護管理療養費 月の初日", "none"),
  rate("管理", "管理", "円", 3000, "訪問看護管理療養費 2日目以降(管理療養費1)", "none"),
  rate("医療", "医療Ⅰ3", "円", 5550, "基本療養費(Ⅰ) 週3日目まで"),
  rate("医療", "医療Ⅰ4", "円", 6550, "基本療養費(Ⅰ) 週4日目以降"),
  rate("医療", "医療Ⅱ3", "円", 5550, "基本療養費(Ⅱ) 同一日2人 週3日目まで"),
  rate("医療", "医療Ⅱ4", "円", 6550, "基本療養費(Ⅱ) 同一日2人 週4日目以降"),
  rate("医療", "医療Ⅱ20", "円", 2780, "基本療養費(Ⅱ) 同一日3人以上 週3日目まで(要確認)"),
  rate("医療", "医療Ⅱ21", "円", 3280, "基本療養費(Ⅱ) 同一日3人以上 週4日目以降(要確認)"),
  rate("医療", "医療Ⅲ", "円", 8500, "基本療養費(Ⅲ) 外泊時"),
  rate("精神", "精神医療Ⅰ3", "円", 5550, "精神科基本療養費(Ⅰ) 30分以上 週3日目まで"),
  rate("精神", "精神医療Ⅰ4", "円", 6550, "精神科基本療養費(Ⅰ) 30分以上 週4日目以降"),
  rate("精神", "精神医療Ⅱ", "円", 1600, "精神科基本療養費(Ⅱ)"),
  rate("精神", "精神医療Ⅲ3", "円", 5550, "精神科基本療養費(Ⅲ) 同一日2人 週3日目まで"),
  rate("精神", "精神医療Ⅲ4", "円", 6550, "精神科基本療養費(Ⅲ) 同一日2人 週4日目以降"),
  rate("精神", "精神医療Ⅲ20", "円", 2780, "精神科基本療養費(Ⅲ) 同一日3人以上 週3日目まで(要確認)"),
  rate("精神", "精神医療Ⅲ21", "円", 3280, "精神科基本療養費(Ⅲ) 同一日3人以上 週4日目以降(要確認)"),
  rate("精神", "精神医療Ⅳ", "円", 8500, "精神科基本療養費(Ⅳ) 外泊時"),
  rate("自費", "自費", "円", 6000, "1件あたり(実際は5,000〜10,000円)"),
  rate("定期巡回", "定期巡回", "円", 0, "1件あたりの金額を入力してください"),
  rate("定期巡回", "随時訪問", "円", 0, "1件あたりの金額を入力してください"),
];

/** 介護保険の1単位あたりの円(地域区分)。仙台市(6級地・訪問看護 10.42円) */
export const DEFAULT_REGION_UNIT_PRICE = 10.42;

export interface VisitCell {
  count: number;
  /** [ ] の数 */
  bracket: number | null;
  /** { } の数 */
  brace: number | null;
}

/** 「19[38]」「22{1}」「33[5]{1}」などのセルを読む */
export function parseVisitCell(v: unknown): VisitCell | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v ? { count: v, bracket: null, brace: null } : null;
  const t = String(v).normalize("NFKC").replace(/\s/g, "");
  const m = t.match(/^(\d+)(?:\[(\d+)\])?(?:\{(\d+)\})?$/);
  if (!m) return null;
  return { count: Number(m[1]), bracket: m[2] ? Number(m[2]) : null, brace: m[3] ? Number(m[3]) : null };
}

export interface VisitColumn {
  index: number;
  group: string;
  code: string;
  key: string;
}

export interface StaffVisitRow {
  rawName: string;
  cells: { column: VisitColumn; cell: VisitCell }[];
}

export interface VisitCountSheet {
  title: string;
  columns: VisitColumn[];
  rows: StaffVisitRow[];
}

/** 表の形(1行目=区分、2行目=サービス名、3行目以降=職員)を読み取る */
export function parseVisitCountSheet(rows: unknown[][]): VisitCountSheet {
  const title = String(rows[0]?.[0] ?? "");
  const codeRowIndex = rows.findIndex((r) => r.some((c) => typeof c === "string" && /職員名|氏名/.test(c)));
  if (codeRowIndex < 1) throw new Error("「訪問職員名」の見出しが見つかりません。iBowの訪問件数詳細表(職員別)か確認してください。");
  const groupRow = rows[codeRowIndex - 1] ?? [];
  const codeRow = rows[codeRowIndex];
  const columns: VisitColumn[] = [];
  let group = "";
  codeRow.forEach((c, i) => {
    if (i === 0) return;
    const g = groupRow[i];
    if (typeof g === "string" && g.trim() && i > 0) group = g.trim();
    if (typeof c === "string" && c.trim()) columns.push({ index: i, group, code: c.trim(), key: feeKey(group, c) });
  });
  const staffRows: StaffVisitRow[] = [];
  for (const r of rows.slice(codeRowIndex + 1)) {
    const rawName = String(r[0] ?? "").trim();
    if (!rawName || /合計|総計/.test(rawName)) continue;
    const cells = columns.map((column) => ({ column, cell: parseVisitCell(r[column.index]) })).filter((x): x is { column: VisitColumn; cell: VisitCell } => !!x.cell);
    staffRows.push({ rawName, cells });
  }
  return { title, columns, rows: staffRows };
}

export interface StaffEstimate {
  rawName: string;
  /** 主として訪問した件数 */
  visits: number;
  /** 副(同行)として訪問した件数 { } */
  subVisits: number;
  amount: number;
  byGroup: Record<string, number>;
}

export interface VisitEstimate {
  staff: StaffEstimate[];
  total: number;
  /** 単価が登録されていない(または0円の)サービスと件数 */
  missingRates: { code: string; group: string; count: number }[];
  /** [n] を差し引いた回数(医療・精神 基本療養費が発生しない回数)の合計 */
  excludedVisits: number;
}

/**
 * 件数×単価で職員ごとの売上を概算する。
 * - { } は副訪問(同行)の回数。売上・件数には含めず、別に数える
 * - [ ] は単価ごとの bracketMode に従う(介護Ⅰ5=請求回数、医療・精神=基本療養費が発生しない回数として差し引く)
 * - 管理療養費は件数に数えない
 */
export function estimateSales(sheet: VisitCountSheet, rates: FeeRate[], regionUnitPrice: number): VisitEstimate {
  const map = new Map(rates.map((r) => [r.key, r]));
  const missing = new Map<string, { code: string; group: string; count: number }>();
  let excludedVisits = 0;
  const staff = sheet.rows.map((row) => {
    let amount = 0;
    let visits = 0;
    let subVisits = 0;
    const byGroup: Record<string, number> = {};
    for (const { column, cell } of row.cells) {
      const r = map.get(column.key);
      const isManagement = column.group === "管理" || /^管理/.test(column.code);
      if (!isManagement) {
        visits += cell.count;
        subVisits += cell.brace ?? 0;
      }
      if (!r || !r.value) {
        const m = missing.get(column.key) ?? { code: column.code, group: column.group, count: 0 };
        m.count += cell.count;
        missing.set(column.key, m);
        continue;
      }
      let qty = cell.count;
      if (r.bracketMode === "billing" && cell.bracket !== null) qty = cell.bracket;
      if (r.bracketMode === "exclude" && cell.bracket !== null) {
        qty = Math.max(0, cell.count - cell.bracket);
        excludedVisits += cell.bracket;
      }
      const yenAmount = r.kind === "単位" ? qty * r.value * regionUnitPrice : qty * r.value;
      amount += yenAmount;
      const g = column.group === "管理" ? "医療" : column.group;
      byGroup[g] = (byGroup[g] ?? 0) + yenAmount;
    }
    return { rawName: row.rawName, visits, subVisits, amount: Math.round(amount), byGroup };
  });
  return {
    staff,
    total: staff.reduce((s, x) => s + x.amount, 0),
    missingRates: [...missing.values()],
    excludedVisits,
  };
}
