"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmtDate, Options, useApi } from "@/onboarding/ui/client";
import { useMe } from "@/onboarding/ui/me";
import { Alert, Button, Card, Empty, Field, inputCls, PageTitle, Tag, Unset, useAction } from "@/onboarding/ui/kit";
import { LEND_STATUS_LABELS, LendStatus } from "@/onboarding/shared/labels";
import { currentQuery } from "@/onboarding/ui/nav";

type Device = {
  id: number; asset_no: string; kind: string; model: string | null; serial: string | null; phone_number: string | null; hire_id: number | null;
  hire_name: string | null; office_id: number | null; office_name: string | null; apple_number_id: number | null; apple_email: string | null;
  apple_status: string | null; auth_code_destination: string | null; auth_manager_id: number | null; auth_manager_name: string | null;
  lend_status: string; lent_date: string | null; passcode_ref?: string | null; note: string | null;
};
type Dash = { hires: { id: number; name: string }[] };
type AppleList = { rows: { id: number; number: number; planned_email: string; actual_email: string | null; status: string; hire_name: string | null }[] };

const empty = { asset_no: "", kind: "iPhone", model: "", serial: "", phone_number: "", hire_id: "", office_id: "", apple_number_id: "", auth_code_destination: "", auth_manager_id: "", lend_status: "stock", lent_date: "", passcode_ref: "", note: "" };

export default function DevicesPage() {
  const me = useMe();
  const { data, error, reload } = useApi<Device[]>("/devices");
  const { data: dash } = useApi<Dash>("/dashboard");
  const { data: opts } = useApi<Options>("/options");
  const { data: apple } = useApi<AppleList>("/apple");
  const { run, busy, msg } = useAction();
  const [form, setForm] = useState<typeof empty | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  useEffect(() => {
    const hire = currentQuery().get("hire");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hire) setForm({ ...empty, hire_id: hire });
  }, []);

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form!, [k]: e.target.value });
  const edit = (d: Device) => {
    setEditId(d.id);
    setForm(Object.fromEntries(Object.keys(empty).map((k) => [k, d[k as keyof Device] === null || d[k as keyof Device] === undefined ? "" : String(d[k as keyof Device])])) as typeof empty);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const save = () => run(async () => {
    const body = Object.fromEntries(Object.entries(form!).map(([k, v]) => [k, v === "" ? null : v]));
    if (editId) await api(`/devices/${editId}`, { method: "PATCH", body });
    else await api("/devices", { method: "POST", body });
    setForm(null); setEditId(null); reload();
  }, "保存しました。");

  return (
    <div className="space-y-5">
      <PageTitle
        sub="端末パスコードは記録せず、認証情報管理ツールの「参照先」だけを登録します。同一職員のiPhone・iPadには同じ会社用Apple Accountを割り当てるのが初期案です(変更できます)。"
        actions={!form && <Button onClick={() => { setEditId(null); setForm({ ...empty }); }}>+ 端末を登録</Button>}
      >
        端末台帳
      </PageTitle>
      {error && <Alert tone="error">{error}</Alert>}
      {msg}
      {form && (
        <Card title={editId ? "端末を編集" : "端末を登録"}>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="管理番号" required><input className={inputCls} value={form.asset_no} onChange={set("asset_no")} /></Field>
            <Field label="端末種別" required><select className={inputCls} value={form.kind} onChange={set("kind")}><option>iPhone</option><option>iPad</option></select></Field>
            <Field label="機種"><input className={inputCls} value={form.model} onChange={set("model")} placeholder="例: iPhone 15" /></Field>
            <Field label="シリアル番号" hint="設定 > 一般 > 情報"><input className={inputCls} value={form.serial} onChange={set("serial")} /></Field>
            {form.kind === "iPhone" && <Field label="iPhoneの電話番号"><input className={inputCls} value={form.phone_number} onChange={set("phone_number")} /></Field>}
            <Field label="利用者(入職者)">
              <select className={inputCls} value={form.hire_id} onChange={set("hire_id")}>
                <option value="">なし(在庫)</option>
                {dash?.hires.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </Field>
            <Field label="所属" hint="利用者がいる場合は利用者の事業所">
              <select className={inputCls} value={form.office_id} onChange={set("office_id")}>
                <option value="">—</option>
                {opts?.offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
            <Field label="Apple Account" hint="空欄なら利用者の番号を自動で割り当て">
              <select className={inputCls} value={form.apple_number_id} onChange={set("apple_number_id")}>
                <option value="">自動(利用者の番号)</option>
                {apple?.rows.filter((a) => a.status === "reserved" || a.status === "created").map((a) => <option key={a.id} value={a.id}>{a.actual_email ?? a.planned_email}({a.hire_name ?? "未割当"})</option>)}
              </select>
            </Field>
            <Field label="認証コード受信先" hint="例: この端末のiPhone(電話番号)"><input className={inputCls} value={form.auth_code_destination} onChange={set("auth_code_destination")} /></Field>
            <Field label="認証先の管理担当者">
              <select className={inputCls} value={form.auth_manager_id} onChange={set("auth_manager_id")}>
                <option value="">未設定</option>
                {opts?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="貸与状況">
              <select className={inputCls} value={form.lend_status} onChange={set("lend_status")}>
                {Object.entries(LEND_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="貸与日"><input type="date" className={inputCls} value={form.lent_date} onChange={set("lent_date")} /></Field>
            <div className="md:col-span-2"><Field label="端末パスコードの参照先" hint="実際のパスコードは入力しないでください"><input className={inputCls} value={form.passcode_ref} onChange={set("passcode_ref")} placeholder="例: 認証情報管理ツール 保管庫「端末」> 管理番号" /></Field></div>
            <div className="md:col-span-2"><Field label="備考"><input className={inputCls} value={form.note} onChange={set("note")} /></Field></div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button disabled={busy} onClick={save}>保存</Button>
            <Button variant="secondary" onClick={() => { setForm(null); setEditId(null); }}>キャンセル</Button>
          </div>
        </Card>
      )}
      <Card title={`登録済みの端末(${data?.length ?? 0}台)`}>
        {data && data.length === 0 ? <Empty>端末が登録されていません。</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="border-b text-left text-xs text-slate-500"><tr><th className="py-2">管理番号</th><th>種別・機種</th><th>シリアル</th><th>電話番号</th><th>利用者・所属</th><th>Apple Account</th><th>認証コード受信先</th><th>認証先の管理者</th><th>貸与</th>{me.actor.role !== "viewer" && <th></th>}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data?.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2 font-semibold">{d.asset_no}</td>
                    <td>{d.kind}<div className="text-xs text-slate-500">{d.model}</div></td>
                    <td className="text-xs">{d.serial ?? "—"}</td>
                    <td className="text-xs">{d.phone_number ?? "—"}</td>
                    <td>{d.hire_id ? <Link className="text-teal-700 hover:underline" href={`/onboarding/hires/${d.hire_id}`}>{d.hire_name}</Link> : "—"}<div className="text-xs text-slate-500">{d.office_name}</div></td>
                    <td className="text-xs">{d.apple_email ?? <Unset />}{d.apple_status === "reserved" && <div><Tag tone="amber">予約中</Tag></div>}</td>
                    <td className="text-xs">{d.auth_code_destination ?? <Unset />}</td>
                    <td className="text-xs">{d.auth_manager_name ?? <Unset />}</td>
                    <td className="text-xs"><Tag tone={d.lend_status === "lent" ? "teal" : "slate"}>{LEND_STATUS_LABELS[d.lend_status as LendStatus]}</Tag><div>{fmtDate(d.lent_date)}</div></td>
                    <td><Button size="sm" variant="secondary" onClick={() => edit(d)}>編集</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
