import type { Metadata } from "next";
import { requireUser } from "@/mos/server/auth";
import {
  addUserAction,
  recalcAction,
  saveAccountAction,
  saveCalcSettingsAction,
  saveCapacityAction,
  saveTargetAction,
  toggleRuleAction,
  toggleUserAction,
} from "@/mos/server/actions";
import { getDb } from "@/mos/server/db";
import { loadSettings } from "@/mos/server/settings";
import { ALLOCATION_LABEL, BEHAVIOR_LABEL, JOB_TYPE_LABEL, ROLE_LABEL, TX_CATEGORY_LABEL, UNIT_LABEL } from "@/mos/domain/types";
import { ActionForm, inputCls } from "@/mos/ui/ActionForm";
import { Card, PageHeader } from "@/mos/ui/Card";
import { dateTime, num } from "@/mos/ui/format";

export const metadata: Metadata = { title: "設定" };

const SECTION_LABEL: Record<string, string> = {
  REVENUE: "売上",
  REVENUE_ADJUSTMENT: "売上調整",
  COGS: "売上原価",
  SGA: "販管費",
  NON_OPERATING_INCOME: "営業外収益",
  NON_OPERATING_EXPENSE: "営業外費用",
  EXTRAORDINARY: "特別損益",
  SUBTOTAL: "小計（計算に使わない）",
};
const METRIC_LABEL = { REVENUE: "売上（円）", OPERATING_PROFIT: "営業利益（円）", VISITS: "訪問件数（件）" } as const;

function thisMonth() {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function SettingsPage() {
  const me = await requireUser(["ADMIN"]);
  const db = getDb();
  const [settings, targets, capacity, accounts, rules, users, lastRun] = await Promise.all([
    loadSettings(db),
    db.target.findMany({ orderBy: [{ yearMonth: "desc" }, { unit: "asc" }], take: 36 }),
    db.staffCapacity.findMany({ orderBy: [{ yearMonth: "desc" }, { unit: "asc" }], take: 36 }),
    db.accountTitle.findMany({ orderBy: { sortOrder: "asc" } }),
    db.classificationRule.findMany({ orderBy: [{ priority: "asc" }, { createdAt: "asc" }] }),
    db.user.findMany({ orderBy: { createdAt: "asc" } }),
    db.recalcRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);
  const ym = thisMonth();
  const common = settings.allocation.common;
  const hq = settings.allocation.hq;

  return (
    <>
      <PageHeader title="設定" description="計算方針・目標・稼働可能時間・科目マスタ・分類ルール・ユーザーを管理します。変更は監査ログに記録されます。" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="計算設定">
          <ActionForm action={saveCalcSettingsAction} submitLabel="保存して再計算">
            <div className="space-y-3 text-sm">
              <label className="block">
                売上照合の許容差（円）
                <input name="tolerance" defaultValue={settings.tolerance} className={`${inputCls} ml-2 w-28`} inputMode="numeric" />
              </label>
              {(
                [
                  ["common", "共通費の配賦基準", common],
                  ["hq", "本部費の配賦基準", hq],
                ] as const
              ).map(([prefix, label, b]) => (
                <fieldset key={prefix} className="rounded-md border border-slate-200 p-2">
                  <legend className="px-1 text-xs text-slate-600">{label}</legend>
                  <select name={`${prefix}Method`} defaultValue={b.method} className={inputCls}>
                    <option value="REVENUE_SHARE">売上高比</option>
                    <option value="FIXED_RATIO">固定比率</option>
                  </select>
                  <span className="ml-2 text-xs">固定比率: 訪問看護</span>
                  <input name={`${prefix}Hk`} defaultValue={b.method === "FIXED_RATIO" ? b.ratios.HOMONKANGO : ""} className={`${inputCls} ml-1 w-14`} />
                  <span className="ml-1 text-xs">居宅支援</span>
                  <input name={`${prefix}Ky`} defaultValue={b.method === "FIXED_RATIO" ? b.ratios.KYOTAKU : ""} className={`${inputCls} ml-1 w-14`} />
                </fieldset>
              ))}
            </div>
          </ActionForm>
          <form action={recalcAction} className="mt-4 border-t border-slate-100 pt-3 text-sm">
            <button className="rounded-md border border-slate-300 px-3 py-1.5">今すぐ全体を再計算</button>
            <span className="ml-2 text-xs text-slate-500">
              最終実行: {dateTime(lastRun?.startedAt)}（{lastRun?.status ?? "—"}）。毎朝8時にも自動実行されます。
            </span>
          </form>
        </Card>

        <Card title="月次目標">
          <ActionForm action={saveTargetAction} submitLabel="保存">
            <div className="flex flex-wrap gap-2 text-sm">
              <input name="yearMonth" type="month" defaultValue={ym} className={inputCls} aria-label="年月" />
              <select name="unit" className={inputCls} aria-label="対象">
                <option value="COMPANY">全社</option>
                <option value="HOMONKANGO">訪問看護</option>
                <option value="KYOTAKU">居宅支援</option>
              </select>
              <select name="metric" className={inputCls} aria-label="指標">
                {Object.entries(METRIC_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <input name="value" placeholder="目標値" inputMode="numeric" className={`${inputCls} w-32`} aria-label="目標値" />
            </div>
          </ActionForm>
          <ul className="mt-3 max-h-48 overflow-y-auto text-sm">
            {targets.map((t) => (
              <li key={t.id} className="border-t border-slate-100 py-1">
                {t.yearMonth} {UNIT_LABEL[t.unit]} {METRIC_LABEL[t.metric]}: {num(t.value)}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="職種別の稼働可能時間（稼働率の分母）">
          <ActionForm action={saveCapacityAction} submitLabel="保存">
            <div className="flex flex-wrap gap-2 text-sm">
              <input name="yearMonth" type="month" defaultValue={ym} className={inputCls} aria-label="年月" />
              <select name="unit" className={inputCls} aria-label="事業所">
                <option value="HOMONKANGO">訪問看護</option>
                <option value="KYOTAKU">居宅支援</option>
              </select>
              <select name="jobType" className={inputCls} aria-label="職種">
                {Object.entries(JOB_TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <input name="headcount" placeholder="人数" inputMode="numeric" className={`${inputCls} w-16`} aria-label="人数" />
              <input name="hours" placeholder="訪問可能時間(h)" inputMode="decimal" className={`${inputCls} w-36`} aria-label="訪問可能時間（時間）" />
            </div>
          </ActionForm>
          <p className="mt-2 text-xs text-slate-500">個人別ではなく職種ごとの合計を入力します。</p>
          <ul className="mt-2 max-h-48 overflow-y-auto text-sm">
            {capacity.map((c) => (
              <li key={c.id} className="border-t border-slate-100 py-1">
                {c.yearMonth} {UNIT_LABEL[c.unit]} {JOB_TYPE_LABEL[c.jobType]}: {c.headcount}人・{num(Math.round(c.availableMinutes / 60))}時間
              </li>
            ))}
          </ul>
        </Card>

        <Card title="ユーザー">
          <ul className="mb-3 text-sm">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 border-t border-slate-100 py-1.5">
                <span>
                  {u.name}（{ROLE_LABEL[u.role]}）<span className="text-xs text-slate-500">{u.email}</span>
                  {!u.active && <span className="ml-1 text-xs text-red-700">無効</span>}
                </span>
                {u.id !== me.id && (
                  <form action={toggleUserAction}>
                    <input type="hidden" name="id" value={u.id} />
                    <button className="text-xs text-teal-700 underline">{u.active ? "無効にする" : "有効にする"}</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <ActionForm action={addUserAction} submitLabel="追加">
            <div className="flex flex-wrap gap-2 text-sm">
              <input name="name" placeholder="氏名" className={`${inputCls} w-28`} aria-label="氏名" />
              <input name="email" type="email" placeholder="メールアドレス" className={`${inputCls} w-52`} aria-label="メールアドレス" />
              <select name="role" className={inputCls} aria-label="ロール">
                <option value="STAFF">職員（集計値のみ）</option>
                <option value="MANAGER">事務・管理者</option>
                <option value="ADMIN">経営者</option>
              </select>
              <input name="password" type="password" placeholder="初期パスワード(10文字以上)" className={`${inputCls} w-52`} aria-label="初期パスワード" autoComplete="new-password" />
            </div>
          </ActionForm>
        </Card>
      </div>

      <div className="mt-4">
        <Card title="勘定科目マスタ（費用区分・配賦区分）">
          <p className="mb-2 text-xs text-slate-500">試算表の科目名と一致させてください。直接費は部門の金額をそのまま使い、共通費・本部費は全社金額を配賦します。</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-1 text-left">科目</th>
                  <th className="text-left">区分・費用区分・配賦区分</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.name} className="border-t border-slate-100">
                    <td className="py-1">{a.name}</td>
                    <td>
                      <ActionForm action={saveAccountAction} submitLabel="保存" className="flex flex-wrap items-center gap-1 [&>div]:mt-0">
                        <input type="hidden" name="name" value={a.name} />
                        <select name="section" defaultValue={a.section} className={inputCls} aria-label="区分">
                          {Object.entries(SECTION_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                        <select name="behavior" defaultValue={a.behavior ?? ""} className={inputCls} aria-label="費用区分">
                          <option value="">—</option>
                          {Object.entries(BEHAVIOR_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                        <select name="allocation" defaultValue={a.allocation ?? ""} className={inputCls} aria-label="配賦区分">
                          <option value="">—</option>
                          {Object.entries(ALLOCATION_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-1 text-sm font-medium">科目を追加</p>
            <ActionForm action={saveAccountAction} submitLabel="追加" className="flex flex-wrap items-center gap-1 [&>div]:mt-0">
              <input name="name" placeholder="科目名" className={`${inputCls} w-40`} aria-label="科目名" />
              <select name="section" defaultValue="SGA" className={inputCls} aria-label="区分">
                {Object.entries(SECTION_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <select name="behavior" defaultValue="" className={inputCls} aria-label="費用区分">
                <option value="">—</option>
                {Object.entries(BEHAVIOR_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <select name="allocation" defaultValue="" className={inputCls} aria-label="配賦区分">
                <option value="">—</option>
                {Object.entries(ALLOCATION_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </ActionForm>
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card title="銀行明細の自動分類ルール">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-1 text-left">優先</th>
                  <th className="text-left">対象</th>
                  <th className="text-left">パターン</th>
                  <th className="text-left">分類</th>
                  <th className="text-left">説明</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className={`border-t border-slate-100 ${r.active ? "" : "text-slate-400"}`}>
                    <td className="py-1">{r.priority}</td>
                    <td className="text-xs">
                      {r.bank ?? "全口座"}・{r.direction === "IN" ? "入金" : r.direction === "OUT" ? "出金" : "入出金"}・{r.field === "MEMO" ? "メモ" : "摘要"}
                    </td>
                    <td className="font-mono text-xs">{r.pattern}</td>
                    <td className="text-xs">
                      {TX_CATEGORY_LABEL[r.category]}
                      {r.accountTitle && `・${r.accountTitle}`}
                      {r.unit && `・${UNIT_LABEL[r.unit]}`}
                    </td>
                    <td className="text-xs">{r.note}</td>
                    <td>
                      <form action={toggleRuleAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="text-xs text-teal-700 underline">{r.active ? "無効にする" : "有効にする"}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">ルールは「未分類取引」画面で手動分類するときに追加できます。</p>
        </Card>
      </div>
    </>
  );
}
