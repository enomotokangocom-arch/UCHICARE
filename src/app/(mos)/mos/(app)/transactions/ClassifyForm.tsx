"use client";
import { useActionState, useState } from "react";
import { classifyTxAction } from "@/mos/server/actions";
import { TX_CATEGORY_LABEL, type TxCategory } from "@/mos/domain/types";

const CATEGORY_ORDER: TxCategory[] = ["EXPENSE", "PAYROLL", "INTERNAL_TRANSFER", "CARD_SETTLEMENT", "LOAN_PRINCIPAL", "LOAN_REPAYMENT_MIXED", "LOAN_INTEREST", "TAX_SOCIAL", "REVENUE_RECEIPT", "OTHER_INCOME", "UNCLASSIFIED"];

export function ClassifyForm({ id, category, accountTitle, unit, accounts }: { id: string; category: TxCategory; accountTitle: string | null; unit: string | null; accounts: string[] }) {
  const [state, action, pending] = useActionState(classifyTxAction, undefined);
  const [cat, setCat] = useState<TxCategory>(category === "UNCLASSIFIED" ? "EXPENSE" : category);
  const isCost = cat === "EXPENSE" || cat === "PAYROLL";
  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5 text-xs">
      <input type="hidden" name="id" value={id} />
      <select name="category" value={cat} onChange={(e) => setCat(e.target.value as TxCategory)} className="rounded border border-slate-300 px-1 py-1" aria-label="分類">
        {CATEGORY_ORDER.map((c) => (
          <option key={c} value={c}>
            {TX_CATEGORY_LABEL[c]}
          </option>
        ))}
      </select>
      {isCost && (
        <>
          <select name="accountTitle" defaultValue={accountTitle ?? ""} className="rounded border border-slate-300 px-1 py-1" aria-label="勘定科目">
            <option value="">科目を選択</option>
            {accounts.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select name="unit" defaultValue={unit ?? ""} className="rounded border border-slate-300 px-1 py-1" aria-label="部門">
            <option value="">部門共通</option>
            <option value="HOMONKANGO">訪問看護</option>
            <option value="KYOTAKU">居宅支援</option>
          </select>
          <select name="allocation" defaultValue="" className="rounded border border-slate-300 px-1 py-1" aria-label="費用区分">
            <option value="">区分は自動</option>
            <option value="DIRECT">直接費</option>
            <option value="COMMON">共通費</option>
            <option value="HQ">本部費</option>
          </select>
        </>
      )}
      {!isCost && (
        <>
          <input type="hidden" name="accountTitle" value="" />
          <input type="hidden" name="unit" value="" />
          <input type="hidden" name="allocation" value="" />
        </>
      )}
      <label className="flex items-center gap-1">
        <input type="checkbox" name="makeRule" /> 同じ摘要を今後も自動分類
      </label>
      <button disabled={pending} className="rounded bg-teal-600 px-2 py-1 font-semibold text-white disabled:opacity-60">
        保存
      </button>
      {state?.error && <span role="alert" className="text-red-700">{state.error}</span>}
      {state?.message && <span className="text-emerald-700">{state.message}</span>}
    </form>
  );
}
