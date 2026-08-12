import { Article } from "./articleTypes";
import { computeSeoScore, SEO_APPROVAL_THRESHOLD } from "./seoScore";

export interface AutoPublishResult {
  articles: Article[];
  publishedId: string | null;
  lastAutoPublishDate: string;
}

/** YYYY-MM-DD 形式の今日の日付を返す。 */
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 承認済み記事の中から、SEOスコアが基準を満たすものを1日1件、公開する。
 * 同じ日に複数回呼ばれても、その日はすでに実行済みなら何もしない(1日1投稿を保証する)。
 * 承認日時が古い記事から先に公開する(公開待ちキューの先入れ先出し)。
 */
export function runDailyAutoPublish(
  articles: Article[],
  lastAutoPublishDate: string | null,
  today: string = todayDateString()
): AutoPublishResult {
  if (lastAutoPublishDate === today) {
    return { articles, publishedId: null, lastAutoPublishDate: today };
  }

  const queue = articles
    .filter((a) => a.status === "approved" && computeSeoScore(a).score >= SEO_APPROVAL_THRESHOLD)
    .sort((a, b) => (a.approvedAt ?? a.createdAt).localeCompare(b.approvedAt ?? b.createdAt));

  const next = queue[0];
  if (!next) {
    return { articles, publishedId: null, lastAutoPublishDate: today };
  }

  const updatedArticles = articles.map((a) =>
    a.id === next.id ? { ...a, status: "published" as const, publishedAt: today } : a
  );

  return { articles: updatedArticles, publishedId: next.id, lastAutoPublishDate: today };
}

/** 承認済みキュー内での記事の順番(1始まり)と、公開予定日の目安を返す。 */
export function estimateQueuePosition(
  articles: Article[],
  articleId: string,
  lastAutoPublishDate: string | null,
  today: string = todayDateString()
): { position: number; estimatedDate: string } | null {
  const queue = articles
    .filter((a) => a.status === "approved" && computeSeoScore(a).score >= SEO_APPROVAL_THRESHOLD)
    .sort((a, b) => (a.approvedAt ?? a.createdAt).localeCompare(b.approvedAt ?? b.createdAt));

  const index = queue.findIndex((a) => a.id === articleId);
  if (index === -1) return null;

  const todaysSlotUsed = lastAutoPublishDate === today;
  const daysFromToday = todaysSlotUsed ? index + 1 : index;
  const date = new Date(today);
  date.setDate(date.getDate() + daysFromToday);

  return { position: index + 1, estimatedDate: date.toISOString().slice(0, 10) };
}
