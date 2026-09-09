"use client";

import { useEffect, useState } from "react";

interface Station {
  id: string;
  name: string;
}

type ThresholdMap = Record<string, Record<string, number>>;

const RULE_LABELS: Record<string, string> = {
  "DR-01": "売上低下",
  "DR-02": "売上予測未達",
  "DR-03": "利用者純減",
  "DR-04": "終了者急増",
  "DR-05": "新規利用者減少",
  "DR-06": "稼働率低下",
  "DR-07": "過稼働",
  "DR-08": "人件費率上昇",
  "DR-09": "営業利益率低下",
  "DR-10": "営業件数不足",
  "DR-11": "営業紹介率低下",
  "DR-12": "重要紹介元休眠",
  "DR-13": "看護師不足",
  "DR-14": "看護師過剰",
  "DR-16": "採用停止",
  "DR-17": "Cash Runway低下",
  "DR-18": "拠点赤字",
  "DR-19": "出店可能性",
  "DR-20": "撤退検討",
};

export function ThresholdEditor({ stations }: { stations: Station[] }) {
  const [scope, setScope] = useState<string>(""); // "" = 組織全体
  const [thresholds, setThresholds] = useState<ThresholdMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // ロード中フラグはfetch開始と同時に立てる、一般的なdata-fetching effectパターン。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    const query = scope ? `?stationId=${scope}` : "";
    fetch(`/api/uchi-os/thresholds${query}`)
      .then((r) => r.json())
      .then((body) => setThresholds(body.thresholds ?? {}))
      .finally(() => setIsLoading(false));
  }, [scope]);

  async function handleSave(ruleCode: string, paramKey: string, value: number) {
    const key = `${ruleCode}:${paramKey}`;
    setSavingKey(key);
    setMessage(null);
    try {
      const response = await fetch("/api/uchi-os/thresholds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stationId: scope || null, ruleCode, paramKey, value }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error?.message ?? "保存に失敗しました");
        return;
      }
      setMessage(`${ruleCode} / ${paramKey} を保存しました`);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <label className="text-xs font-medium text-neutral-500">適用範囲</label>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
        >
          <option value="">組織全体(既定値)</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}(拠点別上書き)
            </option>
          ))}
        </select>
      </div>

      {message && <p className="mb-2 text-xs text-emerald-700">{message}</p>}

      {isLoading ? (
        <p className="text-sm text-neutral-400">読み込み中...</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(thresholds).map(([ruleCode, params]) => (
            <div key={ruleCode} className="rounded-lg border border-neutral-200 p-3">
              <p className="mb-2 text-xs font-semibold text-neutral-700">
                {ruleCode} {RULE_LABELS[ruleCode] ?? ""}
              </p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(params).map(([paramKey, value]) => (
                  <ThresholdInput
                    key={paramKey}
                    paramKey={paramKey}
                    value={value}
                    isSaving={savingKey === `${ruleCode}:${paramKey}`}
                    onSave={(v) => handleSave(ruleCode, paramKey, v)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ThresholdInput({
  paramKey,
  value,
  isSaving,
  onSave,
}: {
  paramKey: string;
  value: number;
  isSaving: boolean;
  onSave: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  return (
    <div className="flex items-center gap-1.5">
      <label className="text-[11px] text-neutral-500">{paramKey}</label>
      <input
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-20 rounded border border-neutral-300 px-1.5 py-0.5 text-xs"
      />
      <button
        onClick={() => onSave(Number(draft))}
        disabled={isSaving || Number(draft) === value}
        className="rounded bg-neutral-900 px-2 py-0.5 text-[11px] font-medium text-white disabled:opacity-30"
      >
        保存
      </button>
    </div>
  );
}
