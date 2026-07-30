import { surveyDefs } from "./surveyDefs";
import { Department, DEPARTMENTS, SurveySubmission, SurveyType } from "./types";
import { scoreToLevel } from "./scoring";

/** レポート上の「本日」。サーバー/クライアントの時刻ずれによる Hydration Mismatch を避けるため固定値を使う */
export const TODAY = new Date("2026-07-30T00:00:00");

const SURVEY_TYPES: SurveyType[] = ["ergonomics", "stressCheck", "backPain", "caregiving"];

/** 決定的な疑似乱数生成器(mulberry32)。SSR/CSRで同じ値を出すために Math.random は使わない */
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 部署ごとの各指標のベース値(0-100, 高いほど健康的) */
const DEPT_BASELINE: Record<Department, Record<SurveyType, number>> = {
  "介護・福祉サービス部": { ergonomics: 62, stressCheck: 60, backPain: 46, caregiving: 50 },
  製造部: { ergonomics: 54, stressCheck: 64, backPain: 52, caregiving: 66 },
  物流部: { ergonomics: 58, stressCheck: 66, backPain: 42, caregiving: 70 },
  営業部: { ergonomics: 72, stressCheck: 58, backPain: 78, caregiving: 62 },
  管理部門: { ergonomics: 75, stressCheck: 62, backPain: 82, caregiving: 68 },
};

/** 1ヶ月あたりのスコア変化(悪化トレンドの演出用。マイナス=悪化) */
const DEPT_MONTHLY_TREND: Partial<Record<Department, Partial<Record<SurveyType, number>>>> = {
  営業部: { stressCheck: -2.8 },
  "介護・福祉サービス部": { backPain: -1.4, caregiving: -1.0 },
};

const MONTH_COUNT = 6;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return `${date.getMonth() + 1}月`;
}

export function getMonthSequence(reference: Date = TODAY): { date: Date; key: string; label: string }[] {
  const months: { date: Date; key: string; label: string }[] = [];
  for (let i = MONTH_COUNT - 1; i >= 0; i -= 1) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
    months.push({ date: d, key: monthKey(d), label: monthLabel(d) });
  }
  return months;
}

function clampScore(score: number): number {
  return Math.max(5, Math.min(98, Math.round(score)));
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function generateMockSubmissions(): SurveySubmission[] {
  const rng = mulberry32(20260729);
  const months = getMonthSequence();
  const submissions: SurveySubmission[] = [];

  months.forEach((month, monthIndex) => {
    const monthsFromNow = MONTH_COUNT - 1 - monthIndex;
    DEPARTMENTS.forEach((department) => {
      SURVEY_TYPES.forEach((type) => {
        const baseline = DEPT_BASELINE[department][type];
        const trendPerMonth = DEPT_MONTHLY_TREND[department]?.[type] ?? 0;
        const respondentCount = 4 + Math.floor(rng() * 4); // 4〜7件/月/部署/指標
        for (let i = 0; i < respondentCount; i += 1) {
          const noise = (rng() - 0.5) * 22;
          const score = clampScore(baseline - trendPerMonth * monthsFromNow + noise);
          const questionCount = surveyDefs[type].questions.length;
          submissions.push({
            id: nextId("seed"),
            type,
            department,
            respondentLabel: "匿名回答者",
            submittedAt: month.date.toISOString(),
            answers: Array.from({ length: questionCount }, () => 2),
            score,
            level: scoreToLevel(score),
          });
        }
      });
    });
  });

  return submissions;
}
