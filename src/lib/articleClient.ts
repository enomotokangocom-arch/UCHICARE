import { ArticleGenerationInput, GeneratedArticleContent } from "./articleTypes";

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
