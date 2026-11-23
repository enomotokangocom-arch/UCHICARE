"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ADMIN_POSITIONS, generateInviteCode, Member, useAuth } from "@/lib/portal/auth";
import { usePortalStore } from "@/lib/portal/store";
import { POSITIONS, unitName } from "@/lib/portal/defaults";
import { Position } from "@/lib/portal/types";
import { StatusPill, buttonClass, inputClass } from "@/components/portal/ui";
import { BulkInvite, inviteMessage } from "./BulkInvite";

const cell = `${inputClass} py-1.5`;


/** 設定・マスタ: ログインアカウント(管理者のみ) */
export function AccountsSection() {
  const me = useAuth((s) => s.member);
  const staff = usePortalStore((s) => s.staff);
  const collection = usePortalStore((s) => s.collection);
  const [members, setMembers] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staffId, setStaffId] = useState("");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data, error } = await supabase().from("portal_members").select("*").order("created_at");
    if (error) setError(error.message);
    else setMembers((data as Member[]) ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase()
      .from("portal_members")
      .select("*")
      .order("created_at")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        else setMembers((data as Member[]) ?? []);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setError(null);
    const { error } = await fn();
    if (error) setError(/duplicate|unique/i.test(error.message) ? "このメールアドレス(または職員)はすでに登録されています。" : error.message);
    await reload();
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const s = staff.find((x) => x.id === staffId);
    if (!s) return;
    await run(() =>
      supabase().from("portal_members").insert({
        email: email.trim().toLowerCase(),
        staff_id: s.id,
        name: s.name,
        unit_id: s.unitId,
        position: s.position,
        is_admin: ADMIN_POSITIONS.includes(s.position),
        invite_code: generateInviteCode(),
      })
    );
    setEmail("");
    setStaffId("");
  }

  async function copy(m: Member) {
    await navigator.clipboard.writeText(inviteMessage(m));
    setCopied(m.id);
    setTimeout(() => setCopied(null), 1500);
  }

  if (!me?.is_admin) return <p className="text-sm text-slate-500">ログインアカウントの管理は、経営者・統括部長・事務長のみ行えます。</p>;

  const free = staff.filter((s) => s.active && !members.some((m) => m.staff_id === s.id));

  return (
    <div className="space-y-4">
      <BulkInvite members={members} onDone={reload} />
      <form onSubmit={add} className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 md:flex-row md:items-end">
        <label className="block flex-1 text-xs font-semibold text-slate-600">
          職員
          <select className={`${cell} mt-1`} required value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">選んでください</option>
            {free.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}({s.position}・{unitName(s.unitId)})
              </option>
            ))}
          </select>
        </label>
        <label className="block flex-1 text-xs font-semibold text-slate-600">
          ログインに使うメールアドレス
          <input type="email" required className={`${cell} mt-1`} placeholder="uchicare000@icloud.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button type="submit" className={buttonClass.primary}>
          ＋ 招待コードを発行
        </button>
      </form>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">⚠ {error}</p>}
      {!loaded ? (
        <p className="text-sm text-slate-400">読み込み中...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="text-left">
                {["職員", "メールアドレス", "状態", "役職", "", ""].map((h, i) => (
                  <th key={i} className="px-2 py-1.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => (
                <tr key={m.id} className={m.active ? "" : "opacity-50"}>
                  <td className="px-2 py-2 font-medium">
                    {m.name}
                    {m.is_admin && <span className="ml-1 text-[10px] font-bold text-gold-700">管理者</span>}
                  </td>
                  <td className="px-2 py-2 text-xs">{m.email}</td>
                  <td className="px-2 py-2">
                    {m.user_id ? (
                      <StatusPill tone="ok">登録済み {m.registered_at ? new Date(m.registered_at).toLocaleDateString("ja-JP") : ""}</StatusPill>
                    ) : (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <StatusPill tone="warn">招待中</StatusPill>
                        <span className="font-mono text-sm font-bold tracking-widest text-brand-700">{m.invite_code}</span>
                        <button type="button" className={buttonClass.ghost} onClick={() => copy(m)}>
                          {copied === m.id ? "✓ コピーしました" : "📋 案内文をコピー"}
                        </button>
                        <button
                          type="button"
                          className={buttonClass.ghost}
                          onClick={() => run(() => supabase().from("portal_members").update({ invite_code: generateInviteCode() }).eq("id", m.id))}
                        >
                          再発行
                        </button>
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <select
                      className={`${cell} w-auto`}
                      value={m.position}
                      disabled={m.id === me.id}
                      onChange={(e) => {
                        const position = e.target.value as Position;
                        collection("staff").update(m.staff_id, { position });
                        void run(() => supabase().from("portal_members").update({ position, is_admin: ADMIN_POSITIONS.includes(position) }).eq("id", m.id));
                      }}
                    >
                      {POSITIONS.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    {m.id !== me.id && (
                      <label className="flex items-center gap-1.5 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand-600"
                          checked={m.active}
                          onChange={(e) => run(() => supabase().from("portal_members").update({ active: e.target.checked }).eq("id", m.id))}
                        />
                        利用可
                      </label>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {m.id !== me.id && (
                      <button
                        type="button"
                        className={buttonClass.danger}
                        onClick={() =>
                          confirm(`${m.name} さんのログインアカウントを削除しますか?${m.user_id ? "(登録済みのため、この人はアプリを使えなくなります)" : ""}`) &&
                          run(() => supabase().from("portal_members").delete().eq("id", m.id))
                        }
                      >
                        削除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-slate-500">
        招待コードを本人に伝え(LINE WORKSなど)、ログイン画面の「はじめての登録」から登録してもらいます。役職を変えると、見られる範囲もすぐに変わります(経営者・統括部長・事務長は管理者)。
      </p>
    </div>
  );
}
