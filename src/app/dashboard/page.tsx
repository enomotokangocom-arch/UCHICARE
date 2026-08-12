"use client";

import { useMemo } from "react";
import { useHealthDataStore } from "@/lib/store";
import {
  categoryAggregates,
  departmentAggregates,
  monthlyTrend,
  overallScore,
} from "@/lib/aggregate";
import { surveyDefs } from "@/lib/surveyDefs";
import { RISK_LEVEL_COLOR, scoreToLevel } from "@/lib/scoring";
import { KpiCard } from "@/components/KpiCard";
import { RiskBadge } from "@/components/RiskBadge";
import { CategoryRadarChart } from "@/components/charts/CategoryRadarChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { DepartmentBarChart } from "@/components/charts/DepartmentBarChart";
import { SurveyType } from "@/lib/types";

const TODAY_LABEL = "2026年7月30日";

export default function DashboardPage() {
  const submissions = useHealthDataStore((s) => s.submissions);

  const categories = useMemo(() => categoryAggregates(submissions), [submissions]);
  const overall = useMemo(() => overallScore(submissions), [submissions]);
  const departments = useMemo(() => departmentAggregates(submissions), [submissions]);
  const trend = useMemo(() => monthlyTrend(submissions), [submissions]);

  const highlights = useMemo(() => {
    const items: { department: string; type: SurveyType; score: number }[] = [];
    departments.forEach((dept) => {
      (Object.entries(dept.categoryScores) as [SurveyType, number | null][]).forEach(
        ([type, score]) => {
          if (score !== null && scoreToLevel(score) === "high") {
            items.push({ department: dept.department, type, score });
          }
        }
      );
    });
    return items.sort((a, b) => a.score - b.score).slice(0, 5);
  }, [departments]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">健康経営ダッシュボード</h1>
          <p className="mt-1 text-sm text-slate-500">
            サンプル株式会社 ・ 基準日 {TODAY_LABEL} ・ 直近6ヶ月の集計データ
          </p>
        </div>
        <p className="text-xs text-slate-400">
          総回答数 {submissions.length.toLocaleString()} 件
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          title="総合健康経営スコア"
          value={overall}
          unit="点"
          accentColor="#0f172a"
          subtext="5指標の平均(100点満点)"
          badge={<RiskBadge level={scoreToLevel(overall)} />}
        />
        {categories.map((cat) => (
          <KpiCard
            key={cat.type}
            title={surveyDefs[cat.type].shortTitle}
            value={cat.averageScore}
            unit="点"
            accentColor={surveyDefs[cat.type].accentColor}
            subtext={`高リスク ${cat.highRiskCount}件 / 回答 ${cat.responseCount}件`}
            badge={<RiskBadge level={cat.level} />}
          />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-800">5指標バランス</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            労働環境・ストレス・腰痛・介護・生活習慣の各リスクを100点満点で比較
          </p>
          <CategoryRadarChart data={categories} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-3">
          <h2 className="text-sm font-semibold text-slate-800">スコア推移(直近6ヶ月)</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            スコアは高いほど健康的・低リスクであることを示します
          </p>
          <TrendLineChart data={trend} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-3">
          <h2 className="text-sm font-semibold text-slate-800">部署別 総合スコア</h2>
          <p className="mt-0.5 text-xs text-slate-500">部署ごとの健康経営スコア(5指標平均)</p>
          <DepartmentBarChart data={departments} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-800">要注意ポイント</h2>
          <p className="mt-0.5 text-xs text-slate-500">高リスクに該当する部署 × 指標(上位5件)</p>
          <ul className="mt-3 space-y-2">
            {highlights.length === 0 && (
              <li className="text-sm text-slate-400">現在、高リスクに該当する組み合わせはありません。</li>
            )}
            {highlights.map((h) => (
              <li
                key={`${h.department}-${h.type}`}
                className="flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{h.department}</p>
                  <p className="text-xs text-slate-500">{surveyDefs[h.type].shortTitle}</p>
                </div>
                <span className="text-sm font-bold text-rose-600">{h.score}点</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">部署別 指標内訳</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="py-2 pr-4 font-medium">部署</th>
                {categories.map((c) => (
                  <th key={c.type} className="py-2 pr-4 font-medium">
                    {surveyDefs[c.type].shortTitle}
                  </th>
                ))}
                <th className="py-2 pr-4 font-medium">総合</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => (
                <tr key={dept.department} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 font-medium text-slate-700">{dept.department}</td>
                  {(Object.keys(surveyDefs) as SurveyType[]).map((type) => {
                    const score = dept.categoryScores[type];
                    return (
                      <td key={type} className="py-2 pr-4">
                        {score === null ? (
                          <span className="text-slate-300">-</span>
                        ) : (
                          <span
                            className="font-semibold"
                            style={{ color: RISK_LEVEL_COLOR[scoreToLevel(score)] }}
                          >
                            {score}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2 pr-4 font-bold text-slate-900">{dept.overallScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
