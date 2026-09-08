"use client";

import { useRouter } from "next/navigation";
import { HealthScoreCard } from "./HealthScoreCard";
import { TodayDecisionCard } from "./TodayDecisionCard";
import type { CeoMorningData } from "@/server/uchi-os/ceo-morning";

export function CeoMorningView({ data }: { data: CeoMorningData }) {
  const router = useRouter();
  const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">CEO Morning</h1>
        <span className="text-sm text-neutral-500">{today}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[320px_1fr]">
        <HealthScoreCard healthScore={data.healthScore} />

        <div>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-700">
              TODAY — 今日、判断すべきこと（{data.decisions.length}）
            </h2>
          </div>

          {data.decisions.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
              現在、判断が必要な異常は検出されていません。
            </div>
          ) : (
            <div className="space-y-4">
              {data.decisions.map((decision) => (
                <TodayDecisionCard key={decision.id} decision={decision} onChanged={() => router.refresh()} />
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => router.push("/uchi-os/chat")}
        className="mt-6 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm text-neutral-500 shadow-sm hover:bg-neutral-50"
      >
        💬 AI経営参謀に聞く：「今月どう？」「一番危ない拠点は？」
      </button>
    </div>
  );
}
