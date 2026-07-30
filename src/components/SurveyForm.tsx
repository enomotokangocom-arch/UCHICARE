"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { surveyDefs } from "@/lib/surveyDefs";
import { calculateSurveyScore, RISK_LEVEL_COLOR, scoreToLevel } from "@/lib/scoring";
import { useHealthDataStore } from "@/lib/store";
import { Department, DEPARTMENTS, SurveyType } from "@/lib/types";
import { RiskBadge } from "@/components/RiskBadge";

export function SurveyForm({ type }: { type: SurveyType }) {
  const surveyDef = surveyDefs[type];
  const addSubmission = useHealthDataStore((s) => s.addSubmission);

  const [department, setDepartment] = useState<Department>(DEPARTMENTS[0]);
  const [answers, setAnswers] = useState<Array<number | null>>(
    () => new Array(surveyDef.questions.length).fill(null)
  );
  const [result, setResult] = useState<{ score: number } | null>(null);

  const answeredCount = answers.filter((a) => a !== null).length;
  const allAnswered = answeredCount === surveyDef.questions.length;

  const progressPercent = useMemo(
    () => Math.round((answeredCount / surveyDef.questions.length) * 100),
    [answeredCount, surveyDef.questions.length]
  );

  function handleAnswer(index: number, value: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handleSubmit() {
    if (!allAnswered) return;
    const finalAnswers = answers as number[];
    const score = calculateSurveyScore(surveyDef, finalAnswers);
    addSubmission({
      id: crypto.randomUUID(),
      type,
      department,
      respondentLabel: "匿名回答者(あなた)",
      submittedAt: new Date().toISOString(),
      answers: finalAnswers,
      score,
      level: scoreToLevel(score),
    });
    setResult({ score });
  }

  function handleRestart() {
    setAnswers(new Array(surveyDef.questions.length).fill(null));
    setResult(null);
  }

  if (result) {
    const level = scoreToLevel(result.score);
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-500">{surveyDef.title}の結果</p>
          <div
            className="mx-auto mt-4 flex h-28 w-28 items-center justify-center rounded-full text-3xl font-bold"
            style={{
              color: RISK_LEVEL_COLOR[level],
              backgroundColor: `${RISK_LEVEL_COLOR[level]}1a`,
            }}
          >
            {result.score}
          </div>
          <div className="mt-4 flex justify-center">
            <RiskBadge level={level} label={surveyDef.resultLabels[level]} />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            {surveyDef.resultAdvice[level]}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              onClick={handleRestart}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              もう一度回答する
            </button>
            <Link
              href="/dashboard"
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              ダッシュボードで確認する
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-start gap-3">
        <span className="text-3xl">{surveyDef.icon}</span>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{surveyDef.title}</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">{surveyDef.description}</p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-xs font-medium text-slate-500">所属部署</label>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value as Department)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:outline-none"
        >
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
        <span>
          回答済み {answeredCount} / {surveyDef.questions.length}
        </span>
        <span>{progressPercent}%</span>
      </div>
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full bg-teal-600 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="space-y-4">
        {surveyDef.questions.map((question, index) => (
          <div
            key={question.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-800">
              {index + 1}. {question.text}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {surveyDef.scaleLabels.map((label, optionIndex) => {
                const value = optionIndex + 1;
                const selected = answers[index] === value;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleAnswer(index, value)}
                    className={clsx(
                      "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                      selected
                        ? "border-teal-600 bg-teal-600 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-teal-300"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={!allAnswered}
          onClick={handleSubmit}
          className={clsx(
            "rounded-lg px-6 py-2.5 text-sm font-semibold transition-colors",
            allAnswered
              ? "bg-teal-600 text-white hover:bg-teal-700"
              : "cursor-not-allowed bg-slate-200 text-slate-400"
          )}
        >
          回答を送信する
        </button>
      </div>
    </div>
  );
}
