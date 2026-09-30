"use client";

import { useState } from "react";
import { Options } from "./client";
import { Button, Field, inputCls } from "./kit";

export type HireFormValue = {
  name: string; name_romaji: string; job_type_id: string; department_id: string; office_id: string;
  start_date: string; prep_deadline: string; preparer_id: string; deputy_id: string; checker_id: string;
};

export function toForm(h: Record<string, unknown> | null): HireFormValue {
  const s = (k: string) => (h?.[k] === null || h?.[k] === undefined ? "" : String(h[k]));
  return {
    name: s("name"), name_romaji: s("name_romaji"), job_type_id: s("job_type_id"), department_id: s("department_id"),
    office_id: s("office_id"), start_date: s("start_date"), prep_deadline: s("prep_deadline"), preparer_id: s("preparer_id"),
    deputy_id: s("deputy_id"), checker_id: s("checker_id"),
  };
}

export function HireForm({
  initial, opts, canAssign, isNew, busy, onSubmit, onCancel,
}: {
  initial: HireFormValue; opts: Options; canAssign: boolean; isNew: boolean; busy: boolean;
  onSubmit: (v: HireFormValue) => void; onCancel?: () => void;
}) {
  const [v, setV] = useState(initial);
  const set = (k: keyof HireFormValue) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const preparers = opts.users.filter((u) => u.role === "preparer" || u.role === "admin");
  const admins = opts.users.filter((u) => u.role === "admin");
  const offices = opts.offices.filter((o) => o.active && (!v.department_id || !o.department_id || String(o.department_id) === v.department_id));
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
    >
      <Field label="氏名" required><input className={inputCls} value={v.name} onChange={set("name")} required /></Field>
      <Field label="氏名ローマ字" required hint="各サービスの登録名に使います(例: Taro Yamada)">
        <input className={inputCls} value={v.name_romaji} onChange={set("name_romaji")} required pattern="[A-Za-z][A-Za-z .'\-]*" />
      </Field>
      <Field label="部門" required hint={isNew ? "部門に応じて作業・サービスが自動で作られます" : "部門は登録後に変更できません"}>
        <select className={inputCls} value={v.department_id} onChange={set("department_id")} required disabled={!isNew}>
          <option value="">選択してください</option>
          {opts.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      <Field label="所属事業所">
        <select className={inputCls} value={v.office_id} onChange={set("office_id")}>
          <option value="">未設定</option>
          {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </Field>
      <Field label="職種">
        <select className={inputCls} value={v.job_type_id} onChange={set("job_type_id")}>
          <option value="">未設定</option>
          {opts.jobTypes.filter((j) => j.active).map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
        </select>
      </Field>
      <Field label="入社日" required><input type="date" className={inputCls} value={v.start_date} onChange={set("start_date")} required /></Field>
      <Field label="準備期限" hint="空欄の場合は管理設定の日数(初期値: 入社日の3日前)で設定されます">
        <input type="date" className={inputCls} value={v.prep_deadline} onChange={set("prep_deadline")} />
      </Field>
      <div />
      <Field label="準備担当者" hint={!canAssign ? "担当者の変更は管理者のみ行えます" : undefined}>
        <select className={inputCls} value={v.preparer_id} onChange={set("preparer_id")} disabled={!canAssign}>
          <option value="">未設定</option>
          {preparers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </Field>
      <Field label="代行担当者">
        <select className={inputCls} value={v.deputy_id} onChange={set("deputy_id")} disabled={!canAssign}>
          <option value="">未設定</option>
          {preparers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </Field>
      <Field label="確認管理者" hint="準備完了の確認を行う管理者">
        <select className={inputCls} value={v.checker_id} onChange={set("checker_id")} disabled={!canAssign}>
          <option value="">未設定</option>
          {admins.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </Field>
      <div className="flex items-end gap-2 md:col-span-2">
        <Button type="submit" disabled={busy}>{isNew ? "登録して作業を作成" : "保存"}</Button>
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>キャンセル</Button>}
      </div>
    </form>
  );
}
