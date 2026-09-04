"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { KpiCard } from "@/components/KpiCard";
import { BranchTable } from "@/components/ceo/BranchTable";
import { CompanyHealthGauge } from "@/components/ceo/CompanyHealthGauge";
import { DataSourcePanel } from "@/components/ceo/DataSourcePanel";
import { DecisionCard } from "@/components/ceo/DecisionCard";
import { ExplainModal } from "@/components/ceo/ExplainModal";
import { ProcessedList } from "@/components/ceo/ProcessedList";
import { CEO_CONFIG } from "@/lib/ceo/config";
import { computeCompanyHealthScore } from "@/lib/ceo/companyScore";
import { latestPerBranch } from "@/lib/ceo/decisionEngine";
import { forecastCompanyProfit, forecastCompanyRevenue } from "@/lib/ceo/forecastEngine";
import { CEO_TODAY, MOCK_REFERRAL_SOURCE_POOL_SIZE } from "@/lib/ceo/mockData";
import { branchUtilization } from "@/lib/ceo/productivityEngine";
import { branchSeries, computeHiringPlan, computeRequiredSales } from "@/lib/ceo/salesEngine";
import { deriveCeoDecisions, useCeoStore } from "@/lib/ceo/store";

const TODAY_LABEL = CEO_TODAY.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });

export default function CeoDashboardPage() {
  const dataset = useCeoStore((s) => s.dataset);
  const approvals = useCeoStore((s) => s.approvals);
  const narrativeOverrides = useCeoStore((s) => s.narrativeOverrides);
  const decide = useCeoStore((s) => s.decide);
  const fetchAiNarratives = useCeoStore((s) => s.fetchAiNarratives);
  const aiStatus = useCeoStore((s) => s.aiStatus);

  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const fetchedForRef = useRef<string | null>(null);

  const { topDecisions, watchList, okDecisions } = useMemo(
    () => deriveCeoDecisions({ dataset, approvals, narrativeOverrides }),
    [dataset, approvals, narrativeOverrides]
  );
  const monitoredDecisions = useMemo(() => [...watchList, ...okDecisions], [watchList, okDecisions]);

  useEffect(() => {
    if (!dataset || topDecisions.length === 0) return;
    if (fetchedForRef.current === dataset.loadedAt) return;
    const needsNarrative = topDecisions.some((d) => d.aiNarrative !== "generated");
    if (!needsNarrative) return;
    fetchedForRef.current = dataset.loadedAt;
    fetchAiNarratives(topDecisions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, topDecisions.length]);

  const selectedDecision = [...topDecisions, ...monitoredDecisions].find((d) => d.decisionId === selectedDecisionId) ?? null;

  if (!dataset) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-xl font-bold text-slate-900">Uchi AI CEO</h1>
        <p className="mt-1 text-sm text-slate-500">
          訪問看護事業の経営データを監視し、今日判断すべきことだけを提示する経営OSです。まずはデータを読み込んでください。
        </p>
        <div className="mt-6">
          <DataSourcePanel />
        </div>
      </div>
    );
  }

  const latest = latestPerBranch(dataset.branchMetrics);
  const companyRevenue = forecastCompanyRevenue(latest);
  const companyProfit = forecastCompanyProfit(latest);
  const healthScore = computeCompanyHealthScore(latest, [...topDecisions, ...monitoredDecisions]);

  const avgUtilization =
    latest.reduce((acc, m) => acc + branchUtilization(m).utilizationRate, 0) / Math.max(1, latest.length);

  const requiredSalesPerBranch = latest.map((m) => computeRequiredSales(m));
  const totalRequiredNewPatients = requiredSalesPerBranch.reduce((a, r) => a + r.requiredNewPatients, 0);
  const totalRequiredSalesActivity = requiredSalesPerBranch.reduce((a, r) => a + r.requiredSalesActivity, 0);

  const totalRequiredFte = latest.reduce((acc, m) => {
    const series = branchSeries(dataset.branchMetrics, m.branch);
    return acc + computeHiringPlan(series, CEO_TODAY).requiredFte;
  }, 0);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Uchi AI CEO ダッシュボード</h1>
          <p className="mt-1 text-sm text-slate-500">
            {CEO_CONFIG.organizationName} ・ 基準日 {TODAY_LABEL} ・ 3拠点 / 看護師{" "}
            {latest.reduce((a, m) => a + m.nurseCount, 0)}名 / 利用者{" "}
            {latest.reduce((a, m) => a + m.currentPatients, 0)}名 / 営業先(母集団) {MOCK_REFERRAL_SOURCE_POOL_SIZE}件
          </p>
        </div>
        <p className="text-xs text-slate-400">
          {dataset.source === "mock" ? "サンプルデータ" : "アップロードデータ"}で計算 ・ AI説明文:{" "}
          {aiStatus === "loading" ? "生成中…" : aiStatus === "done" ? "生成済み" : "テンプレート"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <CompanyHealthGauge breakdown={healthScore} />
        <div className="grid grid-cols-2 gap-4 lg:col-span-3 lg:grid-cols-3">
          <KpiCard
            title="月末売上予測(全社)"
            value={`${Math.round(companyRevenue.forecastRevenue / 10000).toLocaleString()}`}
            unit="万円"
            subtext={`計画比 ${(companyRevenue.gapRatio * 100).toFixed(1)}% / 達成確率 ${(companyRevenue.achievementProbability * 100).toFixed(0)}%`}
            accentColor={companyRevenue.severity === "red" ? "#e11d48" : companyRevenue.severity === "yellow" ? "#d97706" : "#0f172a"}
          />
          <KpiCard
            title="月末利益予測(全社)"
            value={`${Math.round(companyProfit.forecastProfit / 10000).toLocaleString()}`}
            unit="万円"
            subtext={`計画 ${Math.round(companyProfit.profitBudget / 10000).toLocaleString()}万円`}
            accentColor={companyProfit.severity === "red" ? "#e11d48" : companyProfit.severity === "yellow" ? "#d97706" : "#0f172a"}
          />
          <KpiCard
            title="平均稼働率"
            value={(avgUtilization * 100).toFixed(1)}
            unit="%"
            subtext={`目標 ${(CEO_CONFIG.utilization.targetRate * 100).toFixed(0)}%`}
          />
          <KpiCard
            title="必要新規利用者数"
            value={totalRequiredNewPatients.toFixed(1)}
            unit="名"
            subtext="今月の売上Gapを埋めるために必要な人数"
          />
          <KpiCard
            title="必要営業量"
            value={Math.round(totalRequiredSalesActivity).toLocaleString()}
            unit="件/月"
            subtext="必要新規利用者数から逆算"
          />
          <KpiCard
            title="必要採用人数"
            value={totalRequiredFte.toFixed(2)}
            unit="FTE"
            subtext="90日以内の供給不足予測(全拠点合算)"
          />
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">今日CEOが判断すべきこと</h2>
          <span className="text-xs text-slate-400">上位{topDecisions.length}件(優先度順)</span>
        </div>
        {topDecisions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">現在、緊急の判断が必要な項目はありません。</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {topDecisions.map((d) => (
              <DecisionCard
                key={d.decisionId}
                decision={d}
                onApprove={() => decide(d.decisionId, "approved", "CEO", undefined)}
                onReject={() => decide(d.decisionId, "rejected", "CEO", undefined)}
                onModify={() => {
                  const comment = typeof window !== "undefined" ? window.prompt("条件変更の内容を入力してください") : null;
                  if (comment) decide(d.decisionId, "modified", "CEO", comment);
                }}
                onShowDetail={() => setSelectedDecisionId(d.decisionId)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-3">
          <h2 className="text-sm font-semibold text-slate-800">拠点別サマリー</h2>
          <p className="mt-0.5 text-xs text-slate-500">直近月の売上・利益予測と稼働率</p>
          <div className="mt-3">
            <BranchTable metrics={latest} />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-800">AIが処理済み</h2>
          <p className="mt-0.5 text-xs text-slate-500">異常なし・優先度が低い項目はAIが監視を継続しています</p>
          <div className="mt-3">
            <ProcessedList decisions={monitoredDecisions} />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <DataSourcePanel />
      </div>

      {selectedDecision && <ExplainModal decision={selectedDecision} onClose={() => setSelectedDecisionId(null)} />}
    </div>
  );
}
