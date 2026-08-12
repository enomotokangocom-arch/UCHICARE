import { Article, ArticleGenerationInput, GeneratedArticleContent } from "./articleTypes";

/** /api/articles/generate にリクエストし、生成された記事コンテンツを取得する。 */
export async function generateArticle(input: ArticleGenerationInput): Promise<GeneratedArticleContent> {
  const response = await fetch("/api/articles/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error ?? "記事の生成に失敗しました。");
  }

  return data as GeneratedArticleContent;
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error ?? "WordPressへの送信に失敗しました。");
  }

  return data as WordPressPublishResult;
}
