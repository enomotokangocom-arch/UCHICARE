// 設定値・マスタの読み込み（DB に無ければ初期値）
import { DEFAULT_ACCOUNTS, DEFAULT_RULES, type RuleDef } from "../domain/accounts";
import type { AllocationBasis } from "../domain/pl";
import type { AccountInfo } from "../domain/types";
import type { Db } from "./db";

export type Settings = {
  allocation: { common: AllocationBasis; hq: AllocationBasis };
  /** 業務データと試算表の売上照合の許容差（円） */
  tolerance: number;
};

export const DEFAULT_SETTINGS: Settings = {
  allocation: { common: { method: "REVENUE_SHARE" }, hq: { method: "REVENUE_SHARE" } },
  tolerance: 0,
};

export async function loadSettings(db: Db): Promise<Settings> {
  const rows = await db.appSetting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    allocation: (map.get("allocation") as Settings["allocation"] | undefined) ?? DEFAULT_SETTINGS.allocation,
    tolerance: typeof map.get("tolerance") === "number" ? (map.get("tolerance") as number) : DEFAULT_SETTINGS.tolerance,
  };
}

export async function saveSetting(db: Db, key: keyof Settings, value: Settings[keyof Settings]) {
  await db.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function loadAccounts(db: Db): Promise<AccountInfo[]> {
  const rows = await db.accountTitle.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.length ? rows : DEFAULT_ACCOUNTS;
}

export async function loadRules(db: Db): Promise<RuleDef[]> {
  const rows = await db.classificationRule.findMany({ where: { active: true } });
  return rows.map((r) => ({
    id: r.id,
    priority: r.priority,
    bank: r.bank,
    direction: r.direction,
    field: r.field,
    pattern: r.pattern,
    category: r.category,
    accountTitle: r.accountTitle,
    unit: r.unit === "HOMONKANGO" || r.unit === "KYOTAKU" ? r.unit : null,
    allocation: r.allocation,
    behavior: r.behavior,
    note: r.note ?? "",
  }));
}

/** 勘定科目マスタと分類ルールの初期データを投入する（既にあれば何もしない） */
export async function seedMasters(db: Db) {
  if ((await db.accountTitle.count()) === 0) {
    await db.accountTitle.createMany({ data: DEFAULT_ACCOUNTS });
  }
  if ((await db.classificationRule.count()) === 0) {
    await db.classificationRule.createMany({
      data: DEFAULT_RULES.map((r) => ({
        priority: r.priority,
        bank: r.bank,
        direction: r.direction,
        field: r.field,
        pattern: r.pattern,
        category: r.category,
        accountTitle: r.accountTitle,
        unit: r.unit,
        allocation: r.allocation,
        behavior: r.behavior,
        note: r.note,
      })),
    });
  }
}
