"use client";

import { useEffect, useState } from "react";

interface Pool {
  occupation: { code: string; name: string };
  total: number;
  cold: number;
  warm: number;
  hot: number;
  within3Months: number;
  immediate: number;
}

export default function TalentPoolPage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [totalCandidates, setTotalCandidates] = useState(0);

  useEffect(() => {
    fetch("/api/crm/talent-pool")
      .then((r) => r.json())
      .then((d) => {
        setPools(d.pools ?? []);
        setTotalCandidates(d.totalCandidates ?? 0);
      });
  }, []);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Talent Pool</h1>
        <p className="text-sm text-slate-500">
          広告を出す前に、既存の候補者プールを職種別に確認できます。総候補者数: {totalCandidates}名
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pools.map((p) => (
          <div key={p.occupation.code} className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-bold text-slate-900">{p.occupation.name}</h2>
            <p className="mt-1 text-3xl font-bold text-teal-700">{p.total}<span className="ml-1 text-sm font-normal text-slate-400">名</span></p>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-xs text-slate-400">Cold</p>
                <p className="text-lg font-bold text-slate-600">{p.cold}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2">
                <p className="text-xs text-amber-600">Warm</p>
                <p className="text-lg font-bold text-amber-700">{p.warm}</p>
              </div>
              <div className="rounded-lg bg-rose-50 p-2">
                <p className="text-xs text-rose-600">Hot</p>
                <p className="text-lg font-bold text-rose-700">{p.hot}</p>
              </div>
            </div>

            <div className="mt-3 flex justify-between text-xs text-slate-500">
              <span>3ヶ月以内転職: {p.within3Months}名</span>
              <span>今すぐ: {p.immediate}名</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
