"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { KpiCard } from "@/components/KpiCard";
import { BranchTable } from "@/components/ceo/BranchTable";
import { BusinessLineTable } from "@/components/ceo/BusinessLineTable";
import { CompanyHealthGauge } from "@/components/ceo/CompanyHealthGauge";
import { DataSourcePanel } from "@/components/ceo/DataSourcePanel";
import { DecisionCard } from "@/components/ceo/DecisionCard";
import { ExplainModal } from "@/components/ceo/ExplainModal";
import { ProcessedList } from "@/components/ceo/ProcessedList";
import { computeCompanyAggregate } from "@/lib/ceo/companyAggregate";
import { computeCompanyHealthScore } from "@/lib/ceo/companyScore";
import { CEO_CONFIG } from "@/lib/ceo/config";
import { latestPerBranch, latestPerOffice } from "@/lib/ceo/decisionEngine";
import { CEO_TODAY } from "@/lib/ceo/mockData";
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
          Uchi careグループ(訪問看護・健康経営Uchi Well・居宅介護支援・通所介護UCHINOWA)の経営データを監視し、
          今日判断すべきことだけを提示する経営OSです。まずはデータを読み込んでください。
        </p>
        <div className="mt-6">
          <DataSourcePanel />
        </div>
      </div>
    );
  }

  const latest = latestPerBranch(dataset.branchMetrics); // 訪問看護3拠点
  const chLatest = latestPerOffice(dataset.corporateHealthMetrics);
  const cmLatest = latestPerOffice(dataset.careManagementMetrics);
  const dsLatest = latestPerOffice(dataset.dayServiceMetrics);
  const aggregate = computeCompanyAggregate(latest, chLatest, cmLatest, dsLatest);
  const healthScore = computeCompanyHealthScore({
    forecastRevenue: aggregate.forecastRevenue,
    revenueBudget: aggregate.revenueBudget,
    forecastProfit: aggregate.forecastProfit,
    profitBudget: aggregate.profitBudget,
    utilizationRates: aggregate.utilizationRates,
    decisions: [...topDecisions, ...monitoredDecisions],
  });

  const companyGapRatio = aggregate.revenueBudget !== 0 ? (aggregate.forecastRevenue - aggregate.revenueBudget) / aggregate.revenueBudget : 0;
  const avgUtilization =
    aggregate.utilizationRates.length > 0
      ? aggregate.utilizationRates.reduce((a, b) => a + b, 0) / aggregate.utilizationRates.length
      : 0;

  // 必要新規利用者数・必要営業量・必要採用人数は、訪問時間ベースの事業(訪問看護)に
  // 限定して算出する(健康経営Uchi Well・居宅介護支援・通所介護はPhase 0では対象外。08-risks-and-roadmap.md参照)。
  const requiredSalesPerBranch = latest.map((m) => computeRequiredSales(m));
  const totalRequiredNewPatients = requiredSalesPerBranch.reduce((a, r) => a + r.requiredNewPatients, 0);
  const totalRequiredSalesActivity = requiredSalesPerBranch.reduce((a, r) => a + r.requiredSalesActivity, 0);

  const totalRequiredFte = latest.reduce((acc, m) => {
    const series = branchSeries(dataset.branchMetrics, m.branch);
    return acc + computeHiringPlan(series, CEO_TODAY).requiredFte;
  }, 0);

  const totalLocations = latest.length + chLatest.length + cmLatest.length + dsLatest.length;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Uchi AI CEO ダッシュボード</h1>
          <p className="mt-1 text-sm text-slate-500">
            {CEO_CONFIG.organizationName} ・ 基準日 {TODAY_LABEL} ・ 4事業ライン(訪問看護・健康経営Uchi Well・居宅介護支援・
            通所介護UCHINOWA) ・ 拠点/事業所 {totalLocations}件
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
            value={`${Math.round(aggregate.forecastRevenue / 10000).toLocaleString()}`}
            unit="万円"
            subtext={`計画比 ${(companyGapRatio * 100).toFixed(1)}% ・ 4事業ライン合算`}
            accentColor={companyGapRatio <= -0.05 ? "#e11d48" : companyGapRatio <= -0.03 ? "#d97706" : "#0f172a"}
          />
          <KpiCard
            title="月末利益予測(全社)"
            value={`${Math.round(aggregate.forecastProfit / 10000).toLocaleString()}`}
            unit="万円"
            subtext={`計画 ${Math.round(aggregate.profitBudget / 10000).toLocaleString()}万円`}
          />
          <KpiCard
            title="平均稼働率"
            value={(avgUtilization * 100).toFixed(1)}
            unit="%"
            subtext="訪問看護・通所介護の平均"
          />
          <KpiCard
            title="必要新規利用者数"
            value={totalRequiredNewPatients.toFixed(1)}
            unit="名"
            subtext="訪問看護の売上Gapを埋めるために必要な人数"
          />
          <KpiCard
            title="必要営業量"
            value={Math.round(totalRequiredSalesActivity).toLocaleString()}
            unit="件/月"
            subtext="必要新規利用者数から逆算(訪問看護)"
          />
          <KpiCard
            title="必要採用人数"
            value={totalRequiredFte.toFixed(2)}
            unit="FTE"
            subtext="90日以内の供給不足予測(訪問看護)"
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
          <h2 className="text-sm font-semibold text-slate-800">訪問看護 拠点別サマリー</h2>
          <p className="mt-0.5 text-xs text-slate-500">直近月の売上・利益予測と稼働率</p>
          <div className="mt-3">
            <BranchTable metrics={latest} />
          </div>
          <h2 className="mt-6 text-sm font-semibold text-slate-800">健康経営Uchi Well・居宅介護支援・通所介護(UCHINOWA)</h2>
          <p className="mt-0.5 text-xs text-slate-500">契約社数/ケース数/稼働率ベースの事業ライン</p>
          <div className="mt-3">
            <BusinessLineTable corporateHealth={chLatest} careManagement={cmLatest} dayService={dsLatest} />
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
