"use client";

import { ServerDataSection } from "@/components/auth/ServerDataSection";
import { useSync } from "@/lib/portal/sync";
import Link from "next/link";
import { ChangeEvent, FormEvent, ReactNode, useState } from "react";
import { usePortalStore, useCurrentStaff } from "@/lib/portal/store";
import { isAdmin } from "@/lib/portal/logic";
import { AccountsSection } from "@/components/auth/AccountsSection";
import { ADMIN_POSITIONS, generateInviteCode, useAuth } from "@/lib/portal/auth";
import { supabase } from "@/lib/supabase";
import { BUSINESS_UNITS, DEFAULT_LINKS, POSITIONS } from "@/lib/portal/defaults";
import { DEFAULT_FEE_RATES } from "@/lib/portal/visitCount";
import { BusinessUnitId, LinkCategory, Position, StaffRole } from "@/lib/portal/types";
import { newId, todayString } from "@/lib/portal/util";
import { Card, PageContainer, PageHeader, UnitCheckboxes, buttonClass, inputClass } from "@/components/portal/ui";
import { SaveBar, useDraftList, useDraftValue } from "@/components/portal/useDraft";

const CATEGORIES: LinkCategory[] = ["カルテ", "スケジュール", "勤怠", "書類管理", "名刺", "連携・コミュニケーション", "福利厚生", "研修・eラーニング", "マニュアル", "店舗・レジ", "デザイン", "その他"];
const ROLES: StaffRole[] = ["看護師", "准看護師", "理学療法士", "作業療法士", "言語聴覚士", "ケアマネジャー", "事務", "店舗スタッフ", "管理者", "その他"];
const cell = `${inputClass} py-1.5`;

function Section({ id, title, description, action, children }: { id: string; title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          {action && <div className="flex gap-2">{action}</div>}
        </div>
        {children}
      </Card>
    </section>
  );
}

function UnitSelect({ value, onChange, className = cell }: { value: BusinessUnitId; onChange: (v: BusinessUnitId) => void; className?: string }) {
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value as BusinessUnitId)}>
      {BUSINESS_UNITS.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-700">
      <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function PhilosophySection({ canEdit }: { canEdit: boolean }) {
  const philosophy = usePortalStore((s) => s.philosophy);
  const setPhilosophy = usePortalStore((s) => s.setPhilosophy);
  const d = useDraftValue(philosophy, setPhilosophy);
  const v = d.value;
  const field = (key: keyof typeof v, label: string, textarea = false) => (
    <label className={`block text-xs font-semibold text-slate-600 ${textarea ? "md:col-span-2" : ""}`}>
      {label}
      {textarea ? (
        <textarea className={`${cell} mt-1 min-h-28`} value={v[key]} onChange={(e) => d.patch({ [key]: e.target.value })} />
      ) : (
        <input className={`${cell} mt-1`} value={v[key]} onChange={(e) => d.patch({ [key]: e.target.value })} />
      )}
    </label>
  );
  return (
    <Section id="philosophy" title="理念(ミッション・ビジョン・バリュー)" description={`ポータルホームの見出しに表示されます。${canEdit ? "" : "(変更は経営者・統括部長のみ)"}`}>
      <fieldset disabled={!canEdit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {field("mission", "ミッション")}
        {field("missionEn", "ミッション(英語・任意)")}
        {field("vision", "ビジョン")}
        {field("visionEn", "ビジョン(英語・任意)")}
        {field("values", "バリュー(1行に1つ)", true)}
      </fieldset>
      {canEdit && <SaveBar dirty={d.dirty} onSave={d.save} onReset={d.reset} />}
    </Section>
  );
}

function ConsultationSection({ canEdit }: { canEdit: boolean }) {
  const d = useDraftList("consultationDesks");
  return (
    <Section
      id="consultation"
      title="相談窓口"
      description="相談はここで設定したメールアドレス(またはGoogleフォーム)に届きます。完全に匿名で受け付けたい窓口は、メールアドレスを収集しない設定のGoogleフォームのURLも入れてください。変更は経営者・統括部長のみ。"
    >
      <fieldset disabled={!canEdit} className="space-y-3">
        {d.items.map((x) => {
          const up = (patch: Partial<typeof x>) => d.update(x.id, patch);
          return (
            <div key={x.id} className="grid grid-cols-12 gap-2 rounded-lg border border-slate-200 p-3">
              <input className={`${cell} col-span-2 text-center sm:col-span-1`} value={x.icon} onChange={(e) => up({ icon: e.target.value })} aria-label="アイコン" />
              <input className={`${cell} col-span-10 sm:col-span-5`} value={x.name} onChange={(e) => up({ name: e.target.value })} aria-label="窓口名" />
              <input className={`${cell} col-span-12 sm:col-span-6`} placeholder="担当者名" value={x.owner} onChange={(e) => up({ owner: e.target.value })} aria-label="担当者名" />
              <input className={`${cell} col-span-12 sm:col-span-6`} type="email" placeholder="相談を届けるメールアドレス" value={x.email} onChange={(e) => up({ email: e.target.value.trim() })} aria-label="メールアドレス" />
              <input className={`${cell} col-span-12 sm:col-span-6`} type="tel" placeholder="電話番号(任意)" value={x.phone ?? ""} onChange={(e) => up({ phone: e.target.value.trim() })} aria-label="電話番号" />
              <input className={`${cell} col-span-12 sm:col-span-6`} placeholder="GoogleフォームのURL(任意)" value={x.formUrl} onChange={(e) => up({ formUrl: e.target.value.trim() })} aria-label="フォームURL" />
              <input className={`${cell} col-span-12 sm:col-span-6`} placeholder="窓口の説明" value={x.description} onChange={(e) => up({ description: e.target.value })} aria-label="説明" />
            </div>
          );
        })}
      </fieldset>
      {canEdit && <SaveBar dirty={d.dirty} onSave={d.save} onReset={d.reset} />}
    </Section>
  );
}

function FeesSection({ canEdit }: { canEdit: boolean }) {
  const d = useDraftList("feeRates");
  const regionUnitPrice = usePortalStore((s) => s.regionUnitPrice);
  const setRegionUnitPrice = usePortalStore((s) => s.setRegionUnitPrice);
  const region = useDraftValue(regionUnitPrice, setRegionUnitPrice);
  return (
    <Section
      id="fees"
      title="報酬単価(売上の概算用)"
      description="iBowの訪問件数から売上を概算するときの単価です。初期値は2024年度改定の基本報酬(加算・減算なし)。変更は経営者・統括部長のみ。"
      action={
        canEdit && (
          <button type="button" className={buttonClass.ghost} onClick={() => d.setAll(DEFAULT_FEE_RATES)}>
            初期値を読み込む
          </button>
        )
      }
    >
      <fieldset disabled={!canEdit}>
        <label className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-700">
          介護保険の1単位あたりの円(地域区分)
          <input type="number" step="0.01" min="10" className={`${cell} w-28`} value={region.value} onChange={(e) => region.set(Number(e.target.value) || 10)} />
          <span className="text-xs text-slate-500">例: 仙台市(6級地)10.42 / その他 10.00</span>
        </label>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="text-left">
                {["区分", "サービス(iBowの列名)", "単価", "単位", "[ ]の扱い", "メモ"].map((h) => (
                  <th key={h} className="px-2 py-1.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.items.map((r) => {
                const up = (patch: Partial<typeof r>) => d.update(r.id, patch);
                return (
                  <tr key={r.id}>
                    <td className="px-2 py-1 text-xs text-slate-600">{r.group}</td>
                    <td className="px-2 py-1 font-medium">{r.code}</td>
                    <td className="px-2 py-1">
                      <input type="number" min="0" className={`${cell} w-24 text-right`} value={r.value} onChange={(e) => up({ value: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="px-2 py-1">
                      <select className={`${cell} w-auto`} value={r.kind} onChange={(e) => up({ kind: e.target.value as "単位" | "円" })}>
                        <option>単位</option>
                        <option>円</option>
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <select className={`${cell} w-auto text-xs`} value={r.bracketMode} onChange={(e) => up({ bracketMode: e.target.value as typeof r.bracketMode })}>
                        <option value="none">使わない</option>
                        <option value="billing">請求回数として使う</option>
                        <option value="exclude">件数から差し引く</option>
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input className={cell} value={r.note} onChange={(e) => up({ note: e.target.value })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </fieldset>
      {canEdit && (
        <SaveBar
          dirty={d.dirty || region.dirty}
          onSave={() => {
            d.save();
            region.save();
          }}
          onReset={() => {
            d.reset();
            region.reset();
          }}
        />
      )}
    </Section>
  );
}

function LinksSection() {
  const d = useDraftList("links");
  return (
    <Section
      id="links"
      title="外部システム"
      description="各サービスの実際のログインURL(契約ごとのURL)に置き換えてください。URLが空のものは「URL未設定」と表示されます。"
      action={
        <>
          <button type="button" className={buttonClass.ghost} onClick={() => d.setAll(DEFAULT_LINKS)}>
            初期値を読み込む
          </button>
          <button
            type="button"
            className={buttonClass.secondary}
            onClick={() => d.add({ id: newId("l"), name: "新しいシステム", description: "", category: "その他", url: "", icon: "🔗", units: [] }, true)}
          >
            ＋ 追加
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {d.items.map((l) => {
          const up = (patch: Partial<typeof l>) => d.update(l.id, patch);
          return (
            <div key={l.id} className="rounded-lg border border-slate-200 p-3">
              <div className="grid grid-cols-12 gap-2">
                <input className={`${cell} col-span-2 text-center sm:col-span-1`} value={l.icon} onChange={(e) => up({ icon: e.target.value })} aria-label="アイコン" />
                <input className={`${cell} col-span-10 sm:col-span-3`} value={l.name} onChange={(e) => up({ name: e.target.value })} aria-label="名称" />
                <input className={`${cell} col-span-12 sm:col-span-5`} placeholder="https://..." value={l.url} onChange={(e) => up({ url: e.target.value.trim() })} aria-label="URL" />
                <select className={`${cell} col-span-12 sm:col-span-3`} value={l.category} onChange={(e) => up({ category: e.target.value as LinkCategory })}>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <input className={`${cell} col-span-12 sm:col-span-4`} placeholder="説明" value={l.description} onChange={(e) => up({ description: e.target.value })} />
                <input
                  className={`${cell} col-span-12 sm:col-span-8`}
                  placeholder="スマホアプリのURL(App Store など・任意)"
                  value={l.appUrl ?? ""}
                  onChange={(e) => up({ appUrl: e.target.value.trim() })}
                  aria-label="アプリURL"
                />
                <div className="col-span-12 flex items-center justify-between gap-2">
                  <UnitCheckboxes value={l.units} onChange={(units) => up({ units })} />
                  <button type="button" className={buttonClass.danger} onClick={() => d.remove(l.id)}>
                    削除
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <SaveBar dirty={d.dirty} onSave={d.save} onReset={d.reset} />
    </Section>
  );
}

/** 新しい職員の追加(分類・氏名・職種・事業所・メールアドレス)。メールアドレスがあればログインの招待コードも発行する */
function AddStaffForm() {
  const collection = usePortalStore((s) => s.collection);
  const me = useAuth((s) => s.member);
  const blank = { position: "一般スタッフ" as Position, name: "", role: "看護師" as StaffRole, unitId: "houkan" as BusinessUnitId, email: "" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const name = f.name.normalize("NFKC").replace(/\s+/g, " ").trim();
    if (!name) return;
    const email = f.email.trim().toLowerCase();
    if (email && !me?.is_admin) return setMessage("⚠ ログインの招待は経営者・統括部長のみ行えます。メールアドレスを空にして追加してください。");
    setBusy(true);
    const id = newId("s");
    let code: string | null = null;
    if (email) {
      code = generateInviteCode();
      const { error } = await supabase()
        .from("portal_members")
        .insert({ email, staff_id: id, name, unit_id: f.unitId, position: f.position, is_admin: ADMIN_POSITIONS.includes(f.position), invite_code: code });
      if (error) {
        setBusy(false);
        return setMessage(`⚠ 招待できませんでした: ${/duplicate|unique/i.test(error.message) ? "このメールアドレスはすでに登録されています。" : error.message}`);
      }
    }
    collection("staff").add({
      id,
      name,
      unitId: f.unitId,
      role: f.role,
      position: f.position,
      isDriver: true,
      isSafetyManager: false,
      isEvaluator: ADMIN_POSITIONS.includes(f.position) || f.position === "管理者",
      active: true,
    });
    setBusy(false);
    setF(blank);
    setMessage(
      code
        ? `${name} さんを追加し、招待コード「${code}」を発行しました。「ログインアカウント」の「案内文をコピー」で本人に送ってください。`
        : `${name} さんを追加しました(ログインの招待はまだです)。`
    );
  }

  return (
    <form onSubmit={submit} className="mb-4 space-y-3 rounded-lg border border-brand-200 bg-brand-50/40 p-3">
      <h3 className="text-sm font-bold text-slate-900">＋ 新しい職員を追加</h3>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <label className="block text-xs font-semibold text-slate-600">
          分類
          <select className={`${cell} mt-1`} value={f.position} onChange={(e) => setF({ ...f, position: e.target.value as Position })}>
            {POSITIONS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-600 md:col-span-2">
          氏名
          <input required className={`${cell} mt-1`} placeholder="例: 安住 花子" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label className="block text-xs font-semibold text-slate-600">
          職種
          <select className={`${cell} mt-1`} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as StaffRole })}>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-600 md:col-span-2">
          事業所
          <UnitSelect className={`${cell} mt-1`} value={f.unitId} onChange={(unitId) => setF({ ...f, unitId })} />
        </label>
        <label className="col-span-2 block text-xs font-semibold text-slate-600 md:col-span-4">
          ログインに使うメールアドレス(入れると招待コードも発行)
          <input type="email" className={`${cell} mt-1`} placeholder="uchicare000@icloud.com" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </label>
        <div className="col-span-2 flex items-end md:col-span-2">
          <button type="submit" className={`${buttonClass.primary} w-full`} disabled={busy || !f.name.trim()}>
            {busy ? "追加しています..." : f.email.trim() ? "追加して招待コードを発行" : "追加する"}
          </button>
        </div>
      </div>
      {message && <p className={`rounded-lg px-3 py-2 text-sm ${message.startsWith("⚠") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{message}</p>}
    </form>
  );
}

function StaffSection() {
  const d = useDraftList("staff");
  return (
    <Section
      id="staff"
      title="職員"
      description="分類は職務記述書と閲覧範囲に使います(経営者・統括部長=全社、管理者=自事業所、責任者以上=健康経営ツール、主任・一般スタッフ=自分の個人売上のみ)。「運転者」はアルコールチェック・運行管理表の運転者に、「安全運転管理者」は確認者に、「評価者」は人事評価の評価者に表示されます。"
    >
      <AddStaffForm />
      <div className="space-y-2">
        {d.items.map((s) => {
          const up = (patch: Partial<typeof s>) => d.update(s.id, patch);
          return (
            <div key={s.id} className={`grid grid-cols-2 items-center gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-12 ${s.active ? "" : "opacity-50"}`}>
              <input className={`${cell} col-span-2 md:col-span-3`} value={s.name} onChange={(e) => up({ name: e.target.value })} aria-label="氏名" />
              <select className={`${cell} md:col-span-2`} value={s.position} onChange={(e) => up({ position: e.target.value as Position })} aria-label="分類">
                {POSITIONS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <select className={`${cell} md:col-span-2`} value={s.role} onChange={(e) => up({ role: e.target.value as StaffRole })} aria-label="職種">
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <div className="md:col-span-2">
                <UnitSelect value={s.unitId} onChange={(unitId) => up({ unitId })} />
              </div>
              <div className="flex flex-wrap items-center gap-3 md:col-span-3">
                <Check label="運転者" checked={s.isDriver} onChange={(v) => up({ isDriver: v })} />
                <Check label="安全運転管理者" checked={s.isSafetyManager} onChange={(v) => up({ isSafetyManager: v })} />
                <Check label="評価者" checked={s.isEvaluator} onChange={(v) => up({ isEvaluator: v })} />
                <Check label="在籍" checked={s.active} onChange={(v) => up({ active: v })} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        退職者は削除せず「在籍」のチェックを外してください(過去の記録に名前が残ります)。ログインしている職員の分類を変える場合は、「ログインアカウント」でも変更してください。
      </p>
      <SaveBar dirty={d.dirty} onSave={d.save} onReset={d.reset} />
    </Section>
  );
}

function CommitteesSection() {
  const d = useDraftList("committees");
  return (
    <Section
      id="committees"
      title="委員会"
      description="開催頻度は目安です。運営規程や自治体の指導内容に合わせて設定してください(0 = 随時)。"
      action={
        <button type="button" className={buttonClass.secondary} onClick={() => d.add({ id: newId("c"), name: "新しい委員会", units: ["houkan", "kyotaku"], frequencyMonths: 0, description: "" }, true)}>
          ＋ 追加
        </button>
      }
    >
      <div className="space-y-2">
        {d.items.map((c) => {
          const up = (patch: Partial<typeof c>) => d.update(c.id, patch);
          return (
            <div key={c.id} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-200 p-2">
              <input className={`${cell} col-span-12 md:col-span-4`} value={c.name} onChange={(e) => up({ name: e.target.value })} aria-label="委員会名" />
              <label className="col-span-6 flex items-center gap-1 text-xs text-slate-600 md:col-span-2">
                <input type="number" min={0} className={`${cell} w-16`} value={c.frequencyMonths} onChange={(e) => up({ frequencyMonths: Math.max(0, Number(e.target.value) || 0) })} />
                ヶ月毎
              </label>
              <div className="col-span-12 md:col-span-5">
                <UnitCheckboxes value={c.units} onChange={(units) => up({ units })} />
              </div>
              <div className="col-span-6 text-right md:col-span-1">
                <button type="button" className={buttonClass.danger} onClick={() => d.remove(c.id)}>
                  削除
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <SaveBar dirty={d.dirty} onSave={d.save} onReset={d.reset} />
    </Section>
  );
}

function CriteriaSection() {
  const d = useDraftList("criteria");
  return (
    <Section
      id="criteria"
      title="人事評価の評価項目"
      description="各項目を1〜5の5段階で評価します。項目を変更すると、既存の評価表にも反映されます。"
      action={
        <button type="button" className={buttonClass.secondary} onClick={() => d.add({ id: newId("k"), name: "新しい項目", description: "" }, true)}>
          ＋ 追加
        </button>
      }
    >
      <div className="space-y-2">
        {d.items.map((k) => {
          const up = (patch: Partial<typeof k>) => d.update(k.id, patch);
          return (
            <div key={k.id} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-200 p-2">
              <input className={`${cell} col-span-12 md:col-span-3`} value={k.name} onChange={(e) => up({ name: e.target.value })} aria-label="項目名" />
              <input className={`${cell} col-span-10 md:col-span-8`} value={k.description} onChange={(e) => up({ description: e.target.value })} aria-label="説明" />
              <div className="col-span-2 text-right md:col-span-1">
                <button type="button" className={buttonClass.danger} onClick={() => d.remove(k.id)}>
                  削除
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <SaveBar dirty={d.dirty} onSave={d.save} onReset={d.reset} />
    </Section>
  );
}

export default function SettingsPage() {
  const resetAll = usePortalStore((s) => s.resetAll);
  const canEdit = isAdmin(useCurrentStaff());
  const syncMode = useSync((s) => s.mode);

  function exportBackup() {
    const state = usePortalStore.getState() as unknown as Record<string, unknown>;
    const data = Object.fromEntries(Object.entries(state).filter(([, v]) => typeof v !== "function"));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uchicare-portal-backup_${todayString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.staff) || !Array.isArray(data.links)) throw new Error("形式が正しくありません");
      if (syncMode === "server" && !canEdit) throw new Error("サーバーのデータの復元は経営者・統括部長のみ行えます");
      if (!confirm(syncMode === "server" ? "サーバーのデータをバックアップの内容で置き換えます(全職員に反映されます)。よろしいですか?" : "現在のデータをバックアップの内容で置き換えます。よろしいですか?")) return;
      usePortalStore.setState(data);
      alert("バックアップを読み込みました。");
    } catch (err) {
      alert(`読み込みに失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <PageContainer>
      <PageHeader icon="⚙️" title="設定・マスタ" description="外部システムのURL、職員、委員会、評価項目などを管理します。変更は各欄の「保存する」を押すと反映されます。" />

      <nav className="mb-5 flex flex-wrap gap-2 text-xs">
        {[
          ["#accounts", "ログインアカウント"],
          ["#staff", "職員"],
          ["#philosophy", "理念"],
          ["#consultation", "相談窓口"],
          ["#fees", "報酬単価"],
          ["#links", "外部システム"],
          ["#vehicles", "車両"],
          ["#committees", "委員会"],
          ["#criteria", "評価項目"],
          ["#data", "データ管理"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
            {label}
          </a>
        ))}
      </nav>

      <div className="space-y-6">
        <Section id="accounts" title="ログインアカウント" description="職員ごとにログインに使うメールアドレスを登録し、招待コードを発行します。">
          <AccountsSection />
        </Section>
        <StaffSection />
        <PhilosophySection canEdit={canEdit} />
        <ConsultationSection canEdit={canEdit} />
        <FeesSection canEdit={canEdit} />
        <LinksSection />
        <Section id="vehicles" title="車両" description="車両の登録・車検や保険の期限・駐車区画は「車両・駐車場」画面でまとめて管理します。">
          <Link href="/portal/parking" className={buttonClass.secondary}>
            🚙 車両・駐車場管理を開く
          </Link>
        </Section>
        <CommitteesSection />
        <CriteriaSection />
        <Section id="data" title="データ管理" description="データの保存先(サーバー共有)、監査ログ、バックアップを管理します。">
          <ServerDataSection />
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button type="button" className={buttonClass.secondary} onClick={exportBackup}>
              ⬇ バックアップを保存(JSON)
            </button>
            <label className={`${buttonClass.secondary} cursor-pointer`}>
              ⬆ バックアップから復元
              <input type="file" accept="application/json" className="hidden" onChange={importBackup} />
            </label>
            {syncMode !== "server" && (
              <button
                type="button"
                className={buttonClass.danger}
                onClick={() => confirm("すべてのデータを削除してサンプルデータに戻します。元に戻せません。よろしいですか?") && resetAll()}
              >
                すべてのデータを初期化
              </button>
            )}
          </div>
        </Section>
      </div>
    </PageContainer>
  );
}
