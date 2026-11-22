"use client";

import Link from "next/link";
import { ChangeEvent, ReactNode } from "react";
import { usePortalStore, useCurrentStaff } from "@/lib/portal/store";
import { isAdmin } from "@/lib/portal/logic";
import { BUSINESS_UNITS, POSITIONS } from "@/lib/portal/defaults";
import { BusinessUnitId, LinkCategory, Position, StaffRole } from "@/lib/portal/types";
import { newId, todayString } from "@/lib/portal/util";
import { Card, PageContainer, PageHeader, UnitCheckboxes, buttonClass, inputClass } from "@/components/portal/ui";

const CATEGORIES: LinkCategory[] = ["カルテ", "スケジュール", "勤怠", "書類管理", "名刺", "連携・コミュニケーション", "福利厚生", "研修・eラーニング", "マニュアル", "店舗・レジ", "デザイン", "その他"];
const ROLES: StaffRole[] = ["管理者", "看護師", "准看護師", "理学療法士", "作業療法士", "言語聴覚士", "ケアマネジャー", "事務", "店舗スタッフ", "その他"];
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

function UnitSelect({ value, onChange }: { value: BusinessUnitId; onChange: (v: BusinessUnitId) => void }) {
  return (
    <select className={cell} value={value} onChange={(e) => onChange(e.target.value as BusinessUnitId)}>
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

export default function SettingsPage() {
  const state = usePortalStore();
  const { links, staff, committees, criteria, collection, resetLinks, resetAll, philosophy, setPhilosophy } = state;
  const canEditPhilosophy = isAdmin(useCurrentStaff());

  function exportBackup() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { setCurrentStaffId, markNoticeRead, resetAll, resetLinks, resetJobDescriptions, setGoogleSettings, setGoalSheetTemplate, setPhilosophy, clearFinanceSamples, collection, ...data } =
      usePortalStore.getState();
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
      if (!confirm("現在のデータをバックアップの内容で置き換えます。よろしいですか?")) return;
      usePortalStore.setState(data);
      alert("バックアップを読み込みました。");
    } catch (err) {
      alert(`読み込みに失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <PageContainer>
      <PageHeader icon="⚙️" title="設定・マスタ" description="外部システムのURL、職員、車両、委員会、評価項目を管理します。変更は自動で保存されます。" />

      <nav className="mb-5 flex flex-wrap gap-2 text-xs">
        {[
          ["#philosophy", "理念"],
          ["#links", "外部システム"],
          ["#staff", "職員"],
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
        <Section
          id="philosophy"
          title="理念(ミッション・ビジョン・バリュー)"
          description={canEditPhilosophy ? "ポータルホームの見出しに表示されます。" : "ポータルホームの見出しに表示されます(変更は経営者・統括部長・事務長のみ)。"}
        >
          <fieldset disabled={!canEditPhilosophy} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-600">
              ミッション
              <input className={`${cell} mt-1`} value={philosophy.mission} onChange={(e) => setPhilosophy({ mission: e.target.value })} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              ミッション(英語・任意)
              <input className={`${cell} mt-1`} value={philosophy.missionEn} onChange={(e) => setPhilosophy({ missionEn: e.target.value })} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              ビジョン
              <input className={`${cell} mt-1`} value={philosophy.vision} onChange={(e) => setPhilosophy({ vision: e.target.value })} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              ビジョン(英語・任意)
              <input className={`${cell} mt-1`} value={philosophy.visionEn} onChange={(e) => setPhilosophy({ visionEn: e.target.value })} />
            </label>
            <label className="block text-xs font-semibold text-slate-600 md:col-span-2">
              バリュー(1行に1つ)
              <textarea className={`${cell} mt-1 min-h-28`} value={philosophy.values} onChange={(e) => setPhilosophy({ values: e.target.value })} />
            </label>
          </fieldset>
        </Section>

        <Section
          id="links"
          title="外部システム"
          description="各サービスの実際のログインURL(契約ごとのURL)に置き換えてください。URLが空のものは「URL未設定」と表示されます。"
          action={
            <>
              <button type="button" className={buttonClass.ghost} onClick={() => confirm("外部システムのリンクを初期状態に戻しますか?") && resetLinks()}>
                初期値に戻す
              </button>
              <button
                type="button"
                className={buttonClass.secondary}
                onClick={() =>
                  collection("links").add({ id: newId("l"), name: "新しいシステム", description: "", category: "その他", url: "", icon: "🔗", units: [] })
                }
              >
                ＋ 追加
              </button>
            </>
          }
        >
          <div className="space-y-3">
            {links.map((l) => {
              const up = (patch: Partial<typeof l>) => collection("links").update(l.id, patch);
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
                      <button type="button" className={buttonClass.danger} onClick={() => confirm(`「${l.name}」を削除しますか?`) && collection("links").remove(l.id)}>
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          id="staff"
          title="職員"
          description="役職は職務記述書と経営数値の閲覧範囲に使います(経営者・統括部長・事務長=全社、所長=自事業所、その他=自分の個人売上のみ)。「運転者」はアルコールチェック・運行管理表の運転者に、「安全運転管理者」は確認者に、「評価者」は人事評価の評価者に表示されます。"
          action={
            <button
              type="button"
              className={buttonClass.secondary}
              onClick={() =>
                collection("staff").add({ id: newId("s"), name: "新しい職員", unitId: "houkan", role: "看護師", position: "スタッフ", isDriver: true, isSafetyManager: false, isEvaluator: false, active: true })
              }
            >
              ＋ 追加
            </button>
          }
        >
          <div className="space-y-2">
            {staff.map((s) => {
              const up = (patch: Partial<typeof s>) => collection("staff").update(s.id, patch);
              return (
                <div key={s.id} className={`grid grid-cols-2 items-center gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-12 ${s.active ? "" : "opacity-50"}`}>
                  <input className={`${cell} col-span-2 md:col-span-3`} value={s.name} onChange={(e) => up({ name: e.target.value })} aria-label="氏名" />
                  <div className="md:col-span-2">
                    <UnitSelect value={s.unitId} onChange={(unitId) => up({ unitId })} />
                  </div>
                  <select className={`${cell} md:col-span-2`} value={s.role} onChange={(e) => up({ role: e.target.value as StaffRole })} aria-label="職種">
                    {ROLES.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                  <select className={`${cell} md:col-span-2`} value={s.position} onChange={(e) => up({ position: e.target.value as Position })} aria-label="役職">
                    {POSITIONS.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
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
          <p className="mt-2 text-[11px] text-slate-400">退職者は削除せず「在籍」のチェックを外してください(過去の記録に名前が残ります)。</p>
        </Section>

        <Section id="vehicles" title="車両" description="車両の登録・車検や保険の期限・駐車区画は「車両・駐車場」画面でまとめて管理します。">
          <Link href="/portal/parking" className={buttonClass.secondary}>
            🚙 車両・駐車場管理を開く
          </Link>
        </Section>

        <Section
          id="committees"
          title="委員会"
          description="開催頻度は目安です。運営規程や自治体の指導内容に合わせて設定してください(0 = 随時)。"
          action={
            <button
              type="button"
              className={buttonClass.secondary}
              onClick={() => collection("committees").add({ id: newId("c"), name: "新しい委員会", units: ["houkan", "kyotaku"], frequencyMonths: 0, description: "" })}
            >
              ＋ 追加
            </button>
          }
        >
          <div className="space-y-2">
            {committees.map((c) => {
              const up = (patch: Partial<typeof c>) => collection("committees").update(c.id, patch);
              return (
                <div key={c.id} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-200 p-2">
                  <input className={`${cell} col-span-12 md:col-span-4`} value={c.name} onChange={(e) => up({ name: e.target.value })} aria-label="委員会名" />
                  <label className="col-span-6 flex items-center gap-1 text-xs text-slate-600 md:col-span-2">
                    <input
                      type="number"
                      min={0}
                      className={`${cell} w-16`}
                      value={c.frequencyMonths}
                      onChange={(e) => up({ frequencyMonths: Math.max(0, Number(e.target.value) || 0) })}
                    />
                    ヶ月毎
                  </label>
                  <div className="col-span-12 md:col-span-5">
                    <UnitCheckboxes value={c.units} onChange={(units) => up({ units })} />
                  </div>
                  <div className="col-span-6 text-right md:col-span-1">
                    <button type="button" className={buttonClass.danger} onClick={() => confirm(`「${c.name}」を削除しますか?`) && collection("committees").remove(c.id)}>
                      削除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          id="criteria"
          title="人事評価の評価項目"
          description="各項目を1〜5の5段階で評価します。項目を変更すると、既存の評価表にも反映されます。"
          action={
            <button type="button" className={buttonClass.secondary} onClick={() => collection("criteria").add({ id: newId("k"), name: "新しい項目", description: "" })}>
              ＋ 追加
            </button>
          }
        >
          <div className="space-y-2">
            {criteria.map((k) => {
              const up = (patch: Partial<typeof k>) => collection("criteria").update(k.id, patch);
              return (
                <div key={k.id} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-200 p-2">
                  <input className={`${cell} col-span-12 md:col-span-3`} value={k.name} onChange={(e) => up({ name: e.target.value })} aria-label="項目名" />
                  <input className={`${cell} col-span-10 md:col-span-8`} value={k.description} onChange={(e) => up({ description: e.target.value })} aria-label="説明" />
                  <div className="col-span-2 text-right md:col-span-1">
                    <button type="button" className={buttonClass.danger} onClick={() => confirm(`「${k.name}」を削除しますか?`) && collection("criteria").remove(k.id)}>
                      削除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section id="data" title="データ管理" description="データはこの端末のブラウザに保存されています。定期的にバックアップを取ってください。">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass.secondary} onClick={exportBackup}>
              ⬇ バックアップを保存(JSON)
            </button>
            <label className={`${buttonClass.secondary} cursor-pointer`}>
              ⬆ バックアップから復元
              <input type="file" accept="application/json" className="hidden" onChange={importBackup} />
            </label>
            <button
              type="button"
              className={buttonClass.danger}
              onClick={() => confirm("すべてのデータを削除してサンプルデータに戻します。元に戻せません。よろしいですか?") && resetAll()}
            >
              すべてのデータを初期化
            </button>
          </div>
        </Section>
      </div>
    </PageContainer>
  );
}
