// 勘定科目マスタと分類ルールの初期値。
// 科目名は試算表 PDF で確認したもの。費用区分（固定/変動/人件費、直接/共通/本部）は管理会計方針の初期値で、
// 設定画面で変更できる（データではなく方針のため、ここでの値は「推測した実績」ではない）。
import type { AccountInfo, AccountSection, Bank, CostAllocation, CostBehavior, TxCategory, Unit } from "./types";

type Row = [name: string, section: AccountSection, behavior?: CostBehavior, allocation?: CostAllocation];

const ROWS: Row[] = [
  ["訪問看護事業収益", "REVENUE"],
  ["居宅介護事業収益", "REVENUE"],
  ["返戻等", "REVENUE_ADJUSTMENT"],
  ["その他課税売上高", "REVENUE"],
  ["地域売上高", "REVENUE"],
  ["売上高合計", "SUBTOTAL"],
  ["期首商品棚卸高", "SUBTOTAL"],
  ["当期商品仕入高", "SUBTOTAL"],
  ["合計", "SUBTOTAL"],
  ["期末商品棚卸高", "SUBTOTAL"],
  ["売上原価", "COGS", "VARIABLE", "DIRECT"],
  ["売上総損益金額", "SUBTOTAL"],
  ["役員報酬", "SGA", "LABOR", "HQ"],
  ["給料手当", "SGA", "LABOR", "DIRECT"],
  ["賞与", "SGA", "LABOR", "DIRECT"],
  ["法定福利費", "SGA", "LABOR", "DIRECT"],
  ["通勤手当", "SGA", "LABOR", "DIRECT"],
  ["福利厚生費", "SGA", "LABOR", "DIRECT"],
  ["教育訓練費", "SGA", "FIXED", "COMMON"],
  ["交際費", "SGA", "FIXED", "HQ"],
  ["会議費", "SGA", "VARIABLE", "COMMON"],
  ["旅費交通費", "SGA", "VARIABLE", "DIRECT"],
  ["通信費", "SGA", "FIXED", "COMMON"],
  ["消耗品費", "SGA", "VARIABLE", "COMMON"],
  ["修繕費", "SGA", "VARIABLE", "COMMON"],
  ["水道光熱費", "SGA", "FIXED", "DIRECT"],
  ["新聞図書費", "SGA", "FIXED", "COMMON"],
  ["諸会費", "SGA", "FIXED", "HQ"],
  ["ソフト利用料", "SGA", "FIXED", "COMMON"],
  ["支払手数料", "SGA", "VARIABLE", "COMMON"],
  ["車両費", "SGA", "VARIABLE", "DIRECT"],
  ["地代家賃", "SGA", "FIXED", "DIRECT"],
  ["リース料", "SGA", "FIXED", "COMMON"],
  ["保険料", "SGA", "FIXED", "DIRECT"],
  ["租税公課", "SGA", "FIXED", "HQ"],
  ["支払報酬料", "SGA", "FIXED", "HQ"],
  ["減価償却費", "SGA", "FIXED", "COMMON"],
  ["雑費", "SGA", "VARIABLE", "COMMON"],
  ["販売管理費計", "SUBTOTAL"],
  ["営業損益金額", "SUBTOTAL"],
  ["受取利息", "NON_OPERATING_INCOME"],
  ["雑収入", "NON_OPERATING_INCOME"],
  ["営業外収益合計", "SUBTOTAL"],
  ["支払利息", "NON_OPERATING_EXPENSE"],
  ["売掛債権売却損", "NON_OPERATING_EXPENSE"],
  ["営業外費用合計", "SUBTOTAL"],
  ["経常損益金額", "SUBTOTAL"],
  ["固定資産売却益", "EXTRAORDINARY"],
  ["特別利益合計", "SUBTOTAL"],
  ["特別損失合計", "SUBTOTAL"],
  ["税引前当期純損益金額", "SUBTOTAL"],
  ["当期純損益金額", "SUBTOTAL"],
];

export const DEFAULT_ACCOUNTS: AccountInfo[] = ROWS.map(([name, section, behavior, allocation], i) => ({
  name,
  section,
  behavior: behavior ?? null,
  allocation: allocation ?? null,
  sortOrder: (i + 1) * 10,
}));

/** 業務データと照合する試算表の科目（部門ごと） */
export const REVENUE_RECONCILE_ACCOUNT: Record<"HOMONKANGO" | "KYOTAKU", string> = {
  HOMONKANGO: "訪問看護事業収益",
  KYOTAKU: "居宅介護事業収益",
};

export type RuleDef = {
  id?: string;
  priority: number;
  bank: Bank | null;
  direction: "IN" | "OUT" | "ANY";
  field: "DESCRIPTION" | "MEMO";
  pattern: string;
  category: TxCategory;
  accountTitle: string | null;
  unit: Exclude<Unit, "COMPANY" | "HQ"> | null;
  allocation: CostAllocation | null;
  behavior: CostBehavior | null;
  note: string;
};

function rule(
  priority: number,
  direction: RuleDef["direction"],
  pattern: string,
  category: TxCategory,
  note: string,
  extra: Partial<Pick<RuleDef, "accountTitle" | "unit" | "allocation" | "behavior" | "bank" | "field">> = {},
): RuleDef {
  return {
    priority,
    bank: extra.bank ?? null,
    direction,
    field: extra.field ?? "DESCRIPTION",
    pattern,
    category,
    accountTitle: extra.accountTitle ?? null,
    unit: extra.unit ?? null,
    allocation: extra.allocation ?? null,
    behavior: extra.behavior ?? null,
    note,
  };
}

/**
 * 分類ルールの初期値。いずれも実ファイル（2026年8月分の GMO・仙台銀行明細）で確認した摘要パターン。
 * 照合は NFKC 正規化・空白除去・大文字化した部分一致（半角カナで書いても全角と一致する）。
 */
export const DEFAULT_RULES: RuleDef[] = [
  // 二重計上・営業外になるもの（優先度高）
  rule(10, "IN", "ｳﾁｹｱ", "INTERNAL_TRANSFER", "自社名義口座からの入金（口座間振替）"),
  rule(10, "OUT", "ｷﾕｳﾌﾘｼｷﾝ", "PAYROLL", "給与振込資金（総額）", { accountTitle: "給料手当", allocation: "COMMON", behavior: "LABOR" }),
  rule(10, "OUT", "ｾｲｻｸｺｳｺ", "LOAN_REPAYMENT_MIXED", "日本政策金融公庫 返済（元利内訳なし）"),
  rule(10, "OUT", "ﾍﾝｻｲｷﾝ", "LOAN_PRINCIPAL", "借入返済（元金）"),
  rule(10, "OUT", "ｶﾘｲﾚﾘｿｸ", "LOAN_INTEREST", "借入利息", { accountTitle: "支払利息" }),
  rule(10, "OUT", "ｱﾒﾂｸｽ", "CARD_SETTLEMENT", "クレジットカード利用代金の引落"),
  rule(10, "OUT", "ｺｸｾﾞｲｼﾔﾎ", "TAX_SOCIAL", "国税・社会保険料（預り金を含みうるため要確認）"),
  // 入金
  rule(20, "IN", "ﾐﾔｷﾞｹﾝｺｸﾎﾚﾝ", "REVENUE_RECEIPT", "国保連からの報酬入金"),
  rule(20, "IN", "ﾌｲﾅﾝｼﾔﾙｻ-ﾋﾞｽ", "REVENUE_RECEIPT", "ファクタリング入金"),
  rule(20, "IN", "ｼﾖｸｷﾞﾖｳｱﾝﾃｲｷﾖｸ", "OTHER_INCOME", "助成金", { accountTitle: "雑収入" }),
  rule(20, "IN", "ｹﾂｻﾝﾘｿｸ", "OTHER_INCOME", "預金利息", { accountTitle: "受取利息" }),
  rule(20, "IN", "普通預金利息", "OTHER_INCOME", "預金利息", { accountTitle: "受取利息" }),
  rule(20, "IN", "ｷﾔﾂｼﾕﾊﾞﾂｸ", "OTHER_INCOME", "デビットカードのキャッシュバック", { accountTitle: "雑収入" }),
  // 経費（摘要で科目が特定できるもの）
  rule(30, "OUT", "振込手数料", "EXPENSE", "振込手数料", { accountTitle: "支払手数料" }),
  rule(30, "OUT", "ﾌﾘｺﾐﾃｽｳﾘﾖｳ", "EXPENSE", "振込手数料", { accountTitle: "支払手数料" }),
  rule(30, "OUT", "ﾂｷｷﾞﾒﾃｽｳﾘﾖｳ", "EXPENSE", "月極手数料", { accountTitle: "支払手数料" }),
  rule(30, "OUT", "ﾃﾞﾝｿｳﾃｽｳﾘﾖｳ", "EXPENSE", "伝送手数料", { accountTitle: "支払手数料" }),
  rule(30, "OUT", "ｶｲｺﾞﾛｳﾄﾞｳｱﾝﾃｲｾﾝﾀ", "EXPENSE", "居宅介護支援の保険", { accountTitle: "保険料", unit: "KYOTAKU", allocation: "DIRECT" }),
  rule(30, "OUT", "ｾﾞｲﾘｼﾎｳｼﾕｳ", "EXPENSE", "税理士報酬", { accountTitle: "支払報酬料" }),
  rule(30, "OUT", "AIGｿﾝﾎﾟ", "EXPENSE", "損害保険料", { accountTitle: "保険料", allocation: "COMMON" }),
  rule(30, "OUT", "ｾｿﾞﾝ)ﾘ-ｽ", "EXPENSE", "リース料", { accountTitle: "リース料" }),
  rule(30, "OUT", "KDDI", "EXPENSE", "通信費", { accountTitle: "通信費" }),
  rule(30, "OUT", "ｿﾌﾄﾊﾞﾝｸ", "EXPENSE", "通信費", { accountTitle: "通信費" }),
  rule(30, "OUT", "ﾄﾞｺﾓ", "EXPENSE", "通信費", { accountTitle: "通信費" }),
  rule(30, "OUT", "ﾃﾞﾝｷ", "EXPENSE", "電気料金", { accountTitle: "水道光熱費", allocation: "COMMON" }),
  rule(30, "OUT", "ﾎｸｶﾞｽ", "EXPENSE", "ガス料金", { accountTitle: "水道光熱費", allocation: "COMMON" }),
  rule(30, "OUT", "ANTHROPIC", "EXPENSE", "ソフトウェア利用料", { accountTitle: "ソフト利用料" }),
  rule(30, "OUT", "OPENAI", "EXPENSE", "ソフトウェア利用料", { accountTitle: "ソフト利用料" }),
  rule(30, "OUT", "ZOOM.COM", "EXPENSE", "ソフトウェア利用料", { accountTitle: "ソフト利用料" }),
  rule(30, "OUT", "WORKSPACE", "EXPENSE", "ソフトウェア利用料", { accountTitle: "ソフト利用料" }),
  rule(30, "OUT", "MICROSOFT", "EXPENSE", "ソフトウェア利用料", { accountTitle: "ソフト利用料" }),
  rule(30, "OUT", "CANVA", "EXPENSE", "ソフトウェア利用料", { accountTitle: "ソフト利用料" }),
  rule(40, "OUT", "ﾀｸｼｰ", "EXPENSE", "タクシー", { accountTitle: "旅費交通費", allocation: "COMMON" }),
  rule(40, "OUT", "JRﾋｶﾞｼﾆﾎﾝ", "EXPENSE", "JR", { accountTitle: "旅費交通費", allocation: "COMMON" }),
  rule(40, "OUT", "ﾊﾟｰｷﾝｸﾞ", "EXPENSE", "コインパーキング", { accountTitle: "旅費交通費", allocation: "COMMON" }),
  rule(40, "OUT", "ｱｽｸﾙ", "EXPENSE", "事務用品", { accountTitle: "消耗品費" }),
  // 担当者が明細に付けたメモ（科目名そのもの以外の言い換え）
  rule(60, "OUT", "家賃", "EXPENSE", "メモ「家賃」", { field: "MEMO", accountTitle: "地代家賃" }),
  rule(60, "OUT", "電気代", "EXPENSE", "メモ「電気代」", { field: "MEMO", accountTitle: "水道光熱費", allocation: "COMMON" }),
];
