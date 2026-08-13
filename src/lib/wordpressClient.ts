import { markdownToHtml } from "./markdownToHtml";

export interface WordPressPublishInput {
  title: string;
  metaDescription: string;
  body: string;
  callToAction: string;
  targetKeywords: string[];
}

export interface WordPressPublishResult {
  postId: number;
  editUrl: string;
}

interface WordPressConfig {
  baseUrl: string;
  username: string;
  appPassword: string;
}

export function getWordPressConfig(): WordPressConfig | null {
  const baseUrl = process.env.WORDPRESS_URL;
  const username = process.env.WORDPRESS_USERNAME;
  const appPassword = process.env.WORDPRESS_APP_PASSWORD;
  if (!baseUrl || !username || !appPassword) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ""), username, appPassword };
}

/**
 * 認証・User-Agent等の共通ヘッダーを組み立てる。
 * User-Agentが未設定/汎用的だと、レンタルサーバーのWAF(Webアプリケーションファイアウォール)に
 * ボットとして弾かれることがあるため、素性のわかる文字列を明示的に付与している。
 */
function wpHeaders(config: WordPressConfig, extra?: Record<string, string>): Record<string, string> {
  const token = Buffer.from(`${config.username}:${config.appPassword}`).toString("base64");
  return {
    Authorization: `Basic ${token}`,
    "User-Agent": "UCHICARE-ArticleBot/1.0 (+https://uchicare.net)",
    Accept: "application/json",
    ...extra,
  };
}

/**
 * 記事名からWordPressのタグIDを解決する。既存タグを検索し、なければ新規作成する。
 * タグの解決に失敗しても投稿自体は継続できるよう、呼び出し側でエラーを吸収する前提。
 */
async function resolveTagIds(config: WordPressConfig, tagNames: string[]): Promise<number[]> {
  const ids: number[] = [];
  for (const name of tagNames.slice(0, 8)) {
    const searchRes = await fetch(
      `${config.baseUrl}/wp-json/wp/v2/tags?search=${encodeURIComponent(name)}`,
      { headers: wpHeaders(config) }
    );
    if (searchRes.ok) {
      const found = (await searchRes.json()) as { id: number; name: string }[];
      const exact = found.find((t) => t.name === name);
      if (exact) {
        ids.push(exact.id);
        continue;
      }
    }
    const createRes = await fetch(`${config.baseUrl}/wp-json/wp/v2/tags`, {
      method: "POST",
      headers: wpHeaders(config, { "content-type": "application/json" }),
      body: JSON.stringify({ name }),
    });
    if (createRes.ok) {
      const created = (await createRes.json()) as { id: number };
      ids.push(created.id);
    }
  }
  return ids;
}

/**
 * WordPress REST API(wp-json/wp/v2/posts)に下書き記事を作成する。
 * 公開(status=publish)ではなく必ず下書き(draft)として作成し、
 * 実際の公開判断は人がWordPress管理画面で行う想定。
 */
export async function createWordPressDraft(input: WordPressPublishInput): Promise<WordPressPublishResult> {
  const config = getWordPressConfig();
  if (!config) {
    throw new Error(
      "WordPress連携が設定されていません。WORDPRESS_URL / WORDPRESS_USERNAME / WORDPRESS_APP_PASSWORD を環境変数に設定してください。"
    );
  }

  const contentHtml = [
    markdownToHtml(input.body),
    `<p><strong>${input.callToAction}</strong></p>`,
  ].join("\n");

  let tagIds: number[] = [];
  try {
    tagIds = await resolveTagIds(config, input.targetKeywords);
  } catch {
    tagIds = [];
  }

  const response = await fetch(`${config.baseUrl}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: wpHeaders(config, { "content-type": "application/json" }),
    body: JSON.stringify({
      title: input.title,
      content: contentHtml,
      excerpt: input.metaDescription,
      status: "draft",
      ...(tagIds.length > 0 ? { tags: tagIds } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`WordPressへの下書き作成に失敗しました(${response.status}): ${detail.slice(0, 300)}`);
  }

  const post = (await response.json()) as { id: number };
  const editUrl = `${config.baseUrl}/wp-admin/post.php?post=${post.id}&action=edit`;

  return { postId: post.id, editUrl };
}
