"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useHealthDataStore } from "@/lib/store";
import { useSeminarLogStore } from "@/lib/seminarStore";
import {
  seminarCategoryList,
  seminarTopics,
  seminarTopicsByCategory,
} from "@/lib/seminarTopics";
import {
  computeSeminarNeeds,
  formatDateStr,
  needScoreToLevel,
  pickTodaysTopic,
} from "@/lib/seminarPriority";
import { RiskBadge } from "@/components/RiskBadge";

const PRIORITY_LABEL = { high: "優先度:高", medium: "優先度:中", low: "優先度:低" } as const;

export default function SeminarGeneratorPage() {
  const submissions = useHealthDataStore((s) => s.submissions);
  const log = useSeminarLogStore((s) => s.log);

  const todayStr = useMemo(() => formatDateStr(new Date()), []);
  const needs = useMemo(() => computeSeminarNeeds(seminarTopics, submissions), [submissions]);
  const todaysTopic = useMemo(
    () => pickTodaysTopic(seminarTopics, needs, log, todayStr),
    [needs, log, todayStr]
  );
  const generatedToday = log.some((entry) => entry.date === todayStr);

  const history = useMemo(
    () =>
      [...log].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.generatedAt.localeCompare(a.generatedAt))),
    [log]
  );

  const todaysNeed = needs[todaysTopic.id];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">セミナー資料ジェネレーター</h1>
        <p className="mt-1 text-sm text-slate-500">
          労働環境・ストレスチェック・腰痛リスク・介護リスクの調査データから、御社にとって今もっとも刺さるセミナーテーマを提案し、1日1テーマ・PDF資料を作成します。
        </p>
      </div>

      {/* 本日のおすすめテーマ */}
      <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            本日のおすすめテーマ({todayStr})
          </p>
          {generatedToday && (
            <span className="inline-flex items-center rounded-full bg-teal-600 px-2.5 py-0.5 text-xs font-semibold text-white">
              本日分 作成済み
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium text-slate-500">
              {seminarCategoryList.find((c) => c.id === todaysTopic.category)?.label}
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900">{todaysTopic.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{todaysTopic.catchCopy}</p>
            {todaysNeed && <p className="mt-2 text-xs text-slate-500">{todaysNeed.reason}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            {todaysNeed && (
              <RiskBadge
                level={needScoreToLevel(todaysNeed.needScore)}
                label={PRIORITY_LABEL[needScoreToLevel(todaysNeed.needScore)]}
              />
            )}
            <Link
              href={`/seminar/${todaysTopic.id}`}
              className="inline-flex items-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              {generatedToday ? "資料を見る・再保存する" : "資料を作成する"}
            </Link>
          </div>
        </div>
      </div>

      {/* カテゴリ別カタログ */}
      <div className="mt-8 space-y-8">
        {seminarCategoryList.map((category) => {
          const topics = seminarTopicsByCategory(category.id);
          return (
            <div key={category.id}>
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-sm"
                  style={{ backgroundColor: `${category.accentColor}1a` }}
                >
                  {category.icon}
                </span>
                <h2 className="text-sm font-bold text-slate-800">{category.label}</h2>
                <span className="text-xs text-slate-400">{topics.length}テーマ</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {topics.map((topic) => {
                  const need = needs[topic.id];
                  const isToday = topic.id === todaysTopic.id;
                  const generated = log.some((entry) => entry.topicId === topic.id);
                  return (
                    <Link
                      key={topic.id}
                      href={`/seminar/${topic.id}`}
                      className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-teal-300"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-slate-900 group-hover:text-teal-700">
                            {topic.title}
                          </h3>
                          {need && (
                            <RiskBadge
                              level={needScoreToLevel(need.needScore)}
                              label={PRIORITY_LABEL[needScoreToLevel(need.needScore)]}
                            />
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{topic.catchCopy}</p>
                      </div>
                      <div className="mt-3 flex items-center gap-1.5">
                        {isToday && (
                          <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20">
                            本日のおすすめ
                          </span>
                        )}
                        {generated && (
                          <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-inset ring-slate-400/20">
                            作成済み
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 生成履歴 */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">PDF生成履歴</h2>
        <p className="mt-0.5 text-xs text-slate-500">これまでに作成したセミナー資料の記録です</p>
        <div className="mt-3">
          {history.length === 0 ? (
            <p className="text-sm text-slate-400">まだPDFを作成していません。</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {history.map((entry, index) => {
                const topic = seminarTopics.find((t) => t.id === entry.topicId);
                if (!topic) return null;
                return (
                  <li
                    key={`${entry.date}-${entry.topicId}-${index}`}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{topic.title}</p>
                      <p className="text-xs text-slate-500">
                        {entry.date} ・ {seminarCategoryList.find((c) => c.id === topic.category)?.label}
                      </p>
                    </div>
                    <Link
                      href={`/seminar/${topic.id}`}
                      className="shrink-0 text-xs font-semibold text-teal-700 hover:underline"
                    >
                      資料を開く
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
