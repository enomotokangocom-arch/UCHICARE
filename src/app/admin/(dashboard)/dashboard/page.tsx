"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { CANDIDATE_STAGE_LABELS } from "@/lib/crm/constants";

interface DashboardData {
  kpi: {
    totalFriends: number;
    newRegistrations: number;
    blockedTotal: number;
    blockRate: number;
    occupationCaptureRate: number;
    timingCaptureRate: number;
    cold: number;
    warm: number;
    hot: number;
    casualEvents: number;
    visitEvents: number;
    applications: number;
    interviews: number;
    offers: number;
    hires: number;
    declines: number;
    cvrToCasual: number;
    cvrToApplication: number;
    cvrToHire: number;
  };
  poolByOccupation: Array<{ occupation: string; count: number }>;
  funnel: Array<{ stage: string; count: number }>;
}

const PRESETS = [
  { value: "this_month", label: "今月" },
  { value: "last_month", label: "先月" },
  { value: "3m", label: "3ヶ月" },
  { value: "6m", label: "6ヶ月" },
  { value: "1y", label: "1年" },
];

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [preset, setPreset] = useState("3m");
  const [data, setData] = useState<DashboardData | null>(null);

  const load = useCallback(() => {
    return fetch(`/api/crm/dashboard?preset=${preset}`)
      .then((res) => res.json())
      .then((json) => setData(json));
  }, [preset]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return <div className="p-8 text-slate-500">読み込み中...</div>;
  }

  const { kpi } = data;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">採用ダッシュボード</h1>
        <select value={preset} onChange={(e) => setPreset(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="LINE友だち総数" value={kpi.totalFriends} />
        <KpiCard label="新規登録者" value={kpi.newRegistrations} />
        <KpiCard label="ブロック数" value={kpi.blockedTotal} sub={`ブロック率 ${kpi.blockRate}%`} />
        <KpiCard label="職種取得率" value={`${kpi.occupationCaptureRate}%`} />
        <KpiCard label="転職時期取得率" value={`${kpi.timingCaptureRate}%`} />
        <KpiCard label="Cold / Warm / Hot" value={`${kpi.cold} / ${kpi.warm} / ${kpi.hot}`} />
        <KpiCard label="カジュアル面談数" value={kpi.casualEvents} />
        <KpiCard label="見学数" value={kpi.visitEvents} />
        <KpiCard label="応募数" value={kpi.applications} />
        <KpiCard label="面接数" value={kpi.interviews} />
        <KpiCard label="内定数" value={kpi.offers} />
        <KpiCard label="採用数" value={kpi.hires} />
        <KpiCard label="辞退数" value={kpi.declines} />
        <KpiCard label="LINE→面談CVR" value={`${kpi.cvrToCasual}%`} />
        <KpiCard label="LINE→応募CVR" value={`${kpi.cvrToApplication}%`} />
        <KpiCard label="LINE→採用CVR" value={`${kpi.cvrToHire}%`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-bold text-slate-900">ファネル (登録期間内の候補者・現在ステージ)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.funnel.map((f) => ({ ...f, label: CANDIDATE_STAGE_LABELS[f.stage] }))} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={90} />
              <Tooltip />
              <Bar dataKey="count" fill="#0d9488" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-bold text-slate-900">職種別 Talent Pool</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.poolByOccupation}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="occupation" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#0f766e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
