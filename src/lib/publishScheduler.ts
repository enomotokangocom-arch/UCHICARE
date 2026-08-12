import { Article } from "./articleTypes";
import { computeSeoScore, SEO_APPROVAL_THRESHOLD } from "./seoScore";

/** YYYY-MM-DD 形式の今日の日付を返す。 */
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 承認済み・SEOスコアが基準以上の記事を、承認日時が古い順に並べた公開待ちキュー。 */
function approvedQueue(articles: Article[]): Article[] {
  return articles
    .filter((a) => a.status === "approved" && computeSeoScore(a).score >= SEO_APPROVAL_THRESHOLD)
    .sort((a, b) => (a.approvedAt ?? a.createdAt).localeCompare(b.approvedAt ?? b.createdAt));
}

/** 公開待ちキューの先頭(次に自動送信すべき記事)を返す。キューが空ならnull。 */
export function selectNextForAutoPublish(articles: Article[]): Article | null {
  return approvedQueue(articles)[0] ?? null;
}

/** 承認済みキュー内での記事の順番(1始まり)と、公開予定日の目安を返す。 */
export function estimateQueuePosition(
  articles: Article[],
  articleId: string,
  lastAutoPublishDate: string | null,
  today: string = todayDateString()
): { position: number; estimatedDate: string } | null {
  const queue = approvedQueue(articles);
  const index = queue.findIndex((a) => a.id === articleId);
  if (index === -1) return null;

  const todaysSlotUsed = lastAutoPublishDate === today;
  const daysFromToday = todaysSlotUsed ? index + 1 : index;
  const date = new Date(today);
  date.setDate(date.getDate() + daysFromToday);

  return { position: index + 1, estimatedDate: date.toISOString().slice(0, 10) };
}
