"use client";

import { useEffect, useState, useCallback } from "react";

interface Rule {
  id: string;
  actionCode: string;
  label: string;
  points: number;
  isActive: boolean;
}
interface Config {
  id: string;
  warmThreshold: number;
  hotThreshold: number;
}

export default function LeadScorePage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [warmThreshold, setWarmThreshold] = useState(0);
  const [hotThreshold, setHotThreshold] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    return Promise.all([
      fetch("/api/crm/lead-score/rules").then((res) => res.json()),
      fetch("/api/crm/lead-score/config").then((res) => res.json()),
    ]).then(([r, c]) => {
      setRules(r.rules ?? []);
      setConfig(c.config);
      setWarmThreshold(c.config?.warmThreshold ?? 20);
      setHotThreshold(c.config?.hotThreshold ?? 50);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function updatePoints(id: string, points: number) {
    await fetch(`/api/crm/lead-score/rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points }),
    });
    load();
  }

  async function saveThresholds() {
    const res = await fetch("/api/crm/lead-score/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ warmThreshold, hotThreshold }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    setMessage("保存しました。");
    load();
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-xl font-bold text-slate-900">Lead Score設定</h1>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold text-slate-900">温度判定の閾値</h2>
        {message && <p className="mb-2 text-xs text-rose-600">{message}</p>}
        <div className="flex items-end gap-4">
          <div>
            <label className="mb-1 block text-xs text-slate-400">WARM閾値 (以上でWarm)</label>
            <input
              type="number"
              value={warmThreshold}
              onChange={(e) => setWarmThreshold(Number(e.target.value))}
              className="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">HOT閾値 (以上でHot)</label>
            <input
              type="number"
              value={hotThreshold}
              onChange={(e) => setHotThreshold(Number(e.target.value))}
              className="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <button onClick={saveThresholds} className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-semibold text-white">
            保存
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">現在の設定: Warm {config?.warmThreshold}点以上 / Hot {config?.hotThreshold}点以上</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold text-slate-900">行動別スコアルール</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-400">
            <tr>
              <th className="py-1">行動</th>
              <th className="py-1">コード</th>
              <th className="py-1">加算ポイント</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.map((r) => (
              <tr key={r.id}>
                <td className="py-2">{r.label}</td>
                <td className="py-2 text-xs text-slate-400">{r.actionCode}</td>
                <td className="py-2">
                  <input
                    type="number"
                    defaultValue={r.points}
                    onBlur={(e) => updatePoints(r.id, Number(e.target.value))}
                    className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
