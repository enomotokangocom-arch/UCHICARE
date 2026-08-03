"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useHealthDataStore } from "@/lib/store";
import { useSeminarLogStore } from "@/lib/seminarStore";
import { categoryAggregates, overallScore } from "@/lib/aggregate";
import { surveyDefs } from "@/lib/surveyDefs";
import { scoreToLevel } from "@/lib/scoring";
import { formatDateStr } from "@/lib/seminarPriority";
import { SEMINAR_SERIES_NAME, seminarCategoryList, SeminarTopic } from "@/lib/seminarTopics";
import { RiskBadge } from "@/components/RiskBadge";

export function SeminarDetail({ topic }: { topic: SeminarTopic }) {
  const submissions = useHealthDataStore((s) => s.submissions);
  const recordGenerated = useSeminarLogStore((s) => s.recordGenerated);

  const todayStr = useMemo(() => formatDateStr(new Date()), []);
  const category = seminarCategoryList.find((c) => c.id === topic.category)!;

  const dataReference = useMemo(() => {
    if (topic.relatedSurveyType) {
      const agg = categoryAggregates(submissions).find((c) => c.type === topic.relatedSurveyType);
      const def = surveyDefs[topic.relatedSurveyType];
      if (!agg || agg.responseCount === 0) {
        return { label: def.shortTitle, score: null, level: null, note: "現時点で回答データがありません。" };
      }
      return {
        label: def.shortTitle,
        score: agg.averageScore,
        level: agg.level,
        note: `高リスク ${agg.highRiskCount}件 / 回答 ${agg.responseCount}件`,
      };
    }
    const overall = overallScore(submissions);
    return {
      label: "総合健康経営スコア",
      score: overall,
      level: scoreToLevel(overall),
      note: "労働環境・ストレス・腰痛・介護の4指標平均",
    };
  }, [submissions, topic.relatedSurveyType]);

  const handleSavePdf = () => {
    recordGenerated(todayStr, topic.id);
    window.print();
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/seminar" className="text-sm font-medium text-slate-500 hover:text-slate-800">
          ← セミナー一覧に戻る
        </Link>
        <button
          onClick={handleSavePdf}
          className="inline-flex items-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
        >
          PDFとして保存する
        </button>
      </div>
      <p className="mb-4 text-xs text-slate-400 print:hidden">
        「PDFとして保存する」を押すと印刷ダイアログが開きます。送り先で「PDFに保存」を選択してください。
      </p>

      <article className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-sm font-bold text-white">
              U
            </div>
            <div>
              <p className="text-xs font-bold leading-tight text-slate-900">UCHICARE</p>
              <p className="text-[10px] leading-tight text-slate-500">{SEMINAR_SERIES_NAME}</p>
            </div>
          </div>
          <div className="text-right">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: `${category.accentColor}1a`, color: category.accentColor }}
            >
              {category.icon} {category.label}({category.courseName})
            </span>
            <p className="mt-1 text-[11px] text-slate-400">作成日 {todayStr}</p>
          </div>
        </header>

        <div className="mt-6">
          <p className="text-xs font-semibold text-slate-400">テーマ:{topic.title}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{topic.headline}</h1>
          <p className="mt-1.5 text-base font-medium text-teal-700">{topic.catchCopy}</p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] font-semibold text-slate-500">対象</p>
            <p className="mt-0.5 text-sm text-slate-800">{topic.targetAudience}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] font-semibold text-slate-500">ねらい</p>
            <p className="mt-0.5 text-sm text-slate-800">{topic.objective}</p>
          </div>
        </div>

        <section className="mt-6">
          <h2 className="text-sm font-bold text-slate-800">なぜ今、必要なテーマか</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{topic.whyNow}</p>
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <div className="flex-1">
              <p className="text-[11px] font-medium text-slate-500">{dataReference.label}(現状データ)</p>
              <p className="text-xs text-slate-500">{dataReference.note}</p>
            </div>
            <div className="flex items-center gap-2">
              {dataReference.score !== null && (
                <span className="text-lg font-bold text-slate-900">{dataReference.score}点</span>
              )}
              {dataReference.level && <RiskBadge level={dataReference.level} />}
            </div>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-bold text-slate-800">セミナーで学ぶこと</h2>
          <ol className="mt-2 space-y-1.5">
            {topic.keyPoints.map((point, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[11px] font-bold text-teal-700">
                  {i + 1}
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-bold text-slate-800">ワーク・実践</h2>
          <ul className="mt-2 space-y-1.5">
            {topic.practice.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-lg border border-teal-200 bg-teal-50/50 p-4">
          <h2 className="text-sm font-bold text-teal-800">明日からのアクションプラン</h2>
          <ul className="mt-2 space-y-1.5">
            {topic.actionPlan.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-800">
                <span className="mt-0.5 shrink-0">☐</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-6 border-l-4 border-teal-400 pl-3 text-sm italic text-slate-600">
          {topic.closingMessage}
        </p>

        <footer className="mt-8 border-t border-slate-200 pt-3 text-[11px] text-slate-400">
          監修:保健師・療法士・ケアマネジャー ・ UCHICARE 企業向け健康経営データ可視化ツール
        </footer>
      </article>
    </div>
  );
}
