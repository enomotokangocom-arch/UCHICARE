"use client";
import { useActionState, useState } from "react";
import { confirmMappingAction } from "@/mos/server/actions";
import { PURPOSE_FIELDS, type MappingPurpose } from "@/mos/domain/mappingFields";
import type { SheetHeaderInfo } from "@/mos/domain/parsers/mapped";
import { isPiiHeaderClient } from "./pii";

const PURPOSE_LABEL: Record<MappingPurpose, string> = { SALES: "月次売上", VISITS: "訪問記録", METRICS: "経営指標" };

export function MappingForm({ batchId, purposes, info }: { batchId: string; purposes: MappingPurpose[]; info: SheetHeaderInfo[] }) {
  const [state, action, pending] = useActionState(confirmMappingAction.bind(null, batchId), undefined);
  const [purpose, setPurpose] = useState<MappingPurpose>(purposes[0]);
  const headers = [...new Set(info.flatMap((s) => s.headers).filter(Boolean))];
  const nonEmpty = (h: string) => info.reduce((n, s) => n + (s.headers.indexOf(h) >= 0 ? s.nonEmpty[s.headers.indexOf(h)] : 0), 0);
  const fields = PURPOSE_FIELDS[purpose];

  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm">
        <span className="font-medium">取込目的</span>
        <select name="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value as MappingPurpose)} className="ml-2 rounded-md border border-slate-300 px-2 py-1">
          {purposes.map((p) => (
            <option key={p} value={p}>
              {PURPOSE_LABEL[p]}
            </option>
          ))}
        </select>
      </label>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-1 text-left">ファイルの列名</th>
              <th className="text-right">値のある行数</th>
              <th className="text-left">意味（割り当て）</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((h) => {
              const pii = isPiiHeaderClient(h);
              const options = fields.filter((f) => !pii || f.idField);
              return (
                <tr key={h} className="border-t border-slate-100">
                  <td className="py-1.5">
                    {h}
                    {pii && <span className="ml-2 rounded bg-red-50 px-1.5 text-[11px] text-red-800">個人情報の可能性</span>}
                  </td>
                  <td className="text-right tabular-nums">{nonEmpty(h)}</td>
                  <td>
                    <select key={purpose} name={`field:${h}`} defaultValue="IGNORE" className="rounded-md border border-slate-300 px-2 py-1">
                      <option value="IGNORE">取込まない</option>
                      {options.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                          {f.required ? "（必須）" : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {purpose === "VISITS" && (
        <label className="block text-sm">
          <span className="font-medium">状態の値の対応表</span>（1行に「ファイルの値=DONE / PLANNED / CANCELLED」）
          <textarea name="map:status" rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 font-mono text-xs" placeholder={"実施=DONE\n中止=CANCELLED"} />
        </label>
      )}
      {purpose === "VISITS" && (
        <label className="block text-sm">
          <span className="font-medium">職種の値の対応表</span>（NURSE / PT / OT / ST / CARE_MANAGER / OTHER）
          <textarea name="map:jobType" rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 font-mono text-xs" placeholder={"看護師=NURSE\n理学療法士=PT"} />
        </label>
      )}
      <label className="block text-sm">
        <span className="font-medium">事業所の値の対応表</span>（事業所列を割り当てた場合のみ。HOMONKANGO / KYOTAKU。未割当なら訪問看護として取込みます）
        <textarea name="map:unit" rows={2} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 font-mono text-xs" />
      </label>
      <label className="block text-sm">
        <span className="font-medium">メモ</span>
        <input name="note" className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1" />
      </label>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state?.errors && (
        <ul role="alert" className="list-disc pl-5 text-sm text-red-700">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {state?.message && <p className="text-sm text-emerald-700">{state.message}</p>}
      <button disabled={pending} className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "取込中…" : "マッピングを確定して取込む"}
      </button>
    </form>
  );
}
