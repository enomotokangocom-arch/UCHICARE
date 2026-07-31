import { categoryAggregates, overallScore } from "./aggregate";
import { surveyDefs } from "./surveyDefs";
import { RiskLevel, SeminarGeneratedLog, SurveySubmission } from "./types";
import { SeminarTopic } from "./seminarTopics";

export interface SeminarNeed {
  topicId: string;
  /** 0-100、値が大きいほど今すぐ実施すべきテーマであることを示す */
  needScore: number;
  reason: string;
}

const NEED_HIGH_THRESHOLD = 60;
const NEED_MEDIUM_THRESHOLD = 30;

export function needScoreToLevel(needScore: number): RiskLevel {
  if (needScore >= NEED_HIGH_THRESHOLD) return "high";
  if (needScore >= NEED_MEDIUM_THRESHOLD) return "medium";
  return "low";
}

/**
 * 各セミナーテーマの「今すぐ実施すべき度合い」を、関連する調査票の平均スコア・高リスク件数から算出する。
 * 関連調査票のないテーマ(生活習慣病予防など)は、総合健康経営スコアを一般的な必要度として利用する。
 */
export function computeSeminarNeeds(
  topics: SeminarTopic[],
  submissions: SurveySubmission[]
): Record<string, SeminarNeed> {
  const categories = categoryAggregates(submissions);
  const byType = new Map(categories.map((c) => [c.type, c]));
  const overall = overallScore(submissions);

  const needs: Record<string, SeminarNeed> = {};
  topics.forEach((topic) => {
    if (topic.relatedSurveyType) {
      const agg = byType.get(topic.relatedSurveyType);
      const score = agg?.averageScore ?? 50;
      const highRiskCount = agg?.highRiskCount ?? 0;
      const needScore = Math.min(100, Math.max(0, Math.round(100 - score + highRiskCount * 0.6)));
      const surveyTitle = surveyDefs[topic.relatedSurveyType].shortTitle;
      needs[topic.id] = {
        topicId: topic.id,
        needScore,
        reason:
          agg && agg.responseCount > 0
            ? `${surveyTitle}の平均スコア${agg.averageScore}点・高リスク${highRiskCount}件のデータに基づく優先度です。`
            : `${surveyTitle}のデータに基づく優先度です。`,
      };
    } else {
      const needScore = Math.max(0, Math.round(100 - overall));
      needs[topic.id] = {
        topicId: topic.id,
        needScore,
        reason: `総合健康経営スコア(${overall}点)に基づく一般的な優先度です。`,
      };
    }
  });
  return needs;
}

/** 直近のログを新しい方から辿り、まだ一巡していない「現在のサイクル」で使用済みのテーマIDを求める */
function usedInCurrentCycle(log: SeminarGeneratedLog[], allTopicIds: string[]): Set<string> {
  const used = new Set<string>();
  for (let i = log.length - 1; i >= 0; i -= 1) {
    const id = log[i].topicId;
    if (!allTopicIds.includes(id)) continue;
    if (used.has(id)) break; // 同じテーマが再登場した = ここが前サイクルとの境目
    used.add(id);
    if (used.size === allTopicIds.length) {
      // ちょうど全テーマが出そろった直後 = 新しいサイクルを空の状態から始める
      used.clear();
      break;
    }
  }
  return used;
}

/**
 * 本日のおすすめテーマを1件選ぶ。
 * 同じ日にすでに生成済みのテーマがあればそれを返し(再訪問時も同じ提案を保つ)、
 * なければ「全テーマを一巡するまで同じテーマを繰り返さない」制約の中で最も必要度の高いテーマを選ぶ。
 */
export function pickTodaysTopic(
  topics: SeminarTopic[],
  needs: Record<string, SeminarNeed>,
  log: SeminarGeneratedLog[],
  todayStr: string
): SeminarTopic {
  const existingToday = log.find((entry) => entry.date === todayStr);
  if (existingToday) {
    const found = topics.find((t) => t.id === existingToday.topicId);
    if (found) return found;
  }

  const used = usedInCurrentCycle(log, topics.map((t) => t.id));
  const pool = topics.filter((t) => !used.has(t.id));
  const candidates = pool.length > 0 ? pool : topics;

  return [...candidates].sort((a, b) => {
    const diff = (needs[b.id]?.needScore ?? 0) - (needs[a.id]?.needScore ?? 0);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  })[0];
}

export function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
