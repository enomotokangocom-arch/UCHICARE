import { Article, ArticleGenerationInput, GeneratedArticleContent } from "./articleTypes";

/**
 * レスポンスをJSONとしてパースする。JSONでない場合(Vercelのタイムアウト/クラッシュ時の
 * プレーンテキストのエラーページなど)は、ステータスコードと本文の一部を含む
 * わかりやすいエラーメッセージとして投げる。
 */
async function parseJsonResponse<T>(response: Response): Promise<T> {
  const rawText = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(
      `サーバーから予期しない応答がありました(HTTP ${response.status})。時間をおいて再度お試しください。` +
        (rawText ? ` 詳細: ${rawText.slice(0, 200)}` : "")
    );
  }

  if (!response.ok) {
    const message = (data as { error?: string })?.error ?? `処理に失敗しました(HTTP ${response.status})。`;
    throw new Error(message);
  }

  return data as T;
}

/** /api/articles/generate にリクエストし、生成された記事コンテンツを取得する。 */
export async function generateArticle(input: ArticleGenerationInput): Promise<GeneratedArticleContent> {
  const response = await fetch("/api/articles/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseJsonResponse<GeneratedArticleContent>(response);
}

export interface WordPressPublishResult {
  postId: number;
  editUrl: string;
}

/** /api/articles/publish-to-wordpress にリクエストし、WordPressに下書き記事を作成する。 */
export async function publishArticleToWordPress(article: Article): Promise<WordPressPublishResult> {
  const response = await fetch("/api/articles/publish-to-wordpress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: article.title,
      metaDescription: article.metaDescription,
      body: article.body,
      callToAction: article.callToAction,
      targetKeywords: article.targetKeywords,
    }),
  });

  return parseJsonResponse<WordPressPublishResult>(response);
}
