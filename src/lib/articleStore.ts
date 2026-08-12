import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Article } from "./articleTypes";
import { publishArticleToWordPress } from "./articleClient";
import { selectNextForAutoPublish, todayDateString } from "./publishScheduler";

interface ArticleState {
  articles: Article[];
  /** 前回、自動送信処理を実行した日(YYYY-MM-DD)。1日1件の送信を保証するために使う。 */
  lastAutoPublishDate: string | null;
  /**
   * 直近の runAutoPublishIfNeeded 呼び出しでWordPressに送信された記事のID(何もなければnull)。
   * セッションをまたいで残さないよう永続化対象から除外している(バナー表示用)。
   */
  lastAutoPublishedArticleId: string | null;
  /** 直近の自動送信でエラーが発生した場合のメッセージ(永続化しない)。 */
  lastAutoPublishError: string | null;
  addArticle: (article: Article) => void;
  updateArticle: (id: string, patch: Partial<Article>) => void;
  removeArticle: (id: string) => void;
  /**
   * 承認済み記事の公開待ちキューから、その日まだ送信していなければ1件だけWordPressに下書き送信する。
   * バックエンドを持たないプロトタイプのため、アプリを開いたタイミングで
   * 「前回送信から1日以上経過しているか」を判定して実行する(本番運用ではサーバー側のスケジューラを想定)。
   */
  runAutoPublishIfNeeded: () => Promise<void>;
  /** キューでの順番を待たず、指定した記事を今すぐWordPressに下書き送信する。 */
  publishArticleNow: (id: string) => Promise<void>;
}

export const useArticleStore = create<ArticleState>()(
  persist(
    (set, get) => ({
      articles: [],
      lastAutoPublishDate: null,
      lastAutoPublishedArticleId: null,
      lastAutoPublishError: null,
      addArticle: (article) => set((state) => ({ articles: [article, ...state.articles] })),
      updateArticle: (id, patch) =>
        set((state) => ({
          articles: state.articles.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      removeArticle: (id) =>
        set((state) => ({ articles: state.articles.filter((a) => a.id !== id) })),
      runAutoPublishIfNeeded: async () => {
        const today = todayDateString();
        const { articles, lastAutoPublishDate } = get();
        // 同じ日にすでに実行済みなら何もしない(StrictModeによる effect の二重実行対策も兼ねる)。
        if (lastAutoPublishDate === today) return;

        const next = selectNextForAutoPublish(articles);
        if (!next) {
          set({ lastAutoPublishDate: today, lastAutoPublishedArticleId: null, lastAutoPublishError: null });
          return;
        }

        try {
          const result = await publishArticleToWordPress(next);
          set((state) => ({
            articles: state.articles.map((a) =>
              a.id === next.id
                ? {
                    ...a,
                    status: "published",
                    publishedAt: today,
                    wordpressPostId: result.postId,
                    wordpressEditUrl: result.editUrl,
                  }
                : a
            ),
            lastAutoPublishDate: today,
            lastAutoPublishedArticleId: next.id,
            lastAutoPublishError: null,
          }));
        } catch (error) {
          // 失敗した日は lastAutoPublishDate を進めず、次回アプリを開いたときに再試行できるようにする。
          set({
            lastAutoPublishedArticleId: null,
            lastAutoPublishError:
              error instanceof Error ? error.message : "WordPressへの自動送信に失敗しました。",
          });
        }
      },
      publishArticleNow: async (id) => {
        const article = get().articles.find((a) => a.id === id);
        if (!article) return;
        const result = await publishArticleToWordPress(article);
        const today = todayDateString();
        set((state) => ({
          articles: state.articles.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status: "published",
                  publishedAt: today,
                  wordpressPostId: result.postId,
                  wordpressEditUrl: result.editUrl,
                }
              : a
          ),
        }));
      },
    }),
    {
      name: "uchicare-articles",
      skipHydration: true,
      partialize: (state) => ({ articles: state.articles, lastAutoPublishDate: state.lastAutoPublishDate }),
    }
  )
);
