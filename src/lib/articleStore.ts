import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Article } from "./articleTypes";
import { runDailyAutoPublish, todayDateString } from "./publishScheduler";

interface ArticleState {
  articles: Article[];
  /** 前回、自動公開処理を実行した日(YYYY-MM-DD)。1日1件の公開を保証するために使う。 */
  lastAutoPublishDate: string | null;
  /**
   * 直近の runAutoPublishIfNeeded 呼び出しで自動公開された記事のID(何も公開されなければnull)。
   * セッションをまたいで残さないよう永続化対象から除外している(バナー表示用)。
   */
  lastAutoPublishedArticleId: string | null;
  addArticle: (article: Article) => void;
  updateArticle: (id: string, patch: Partial<Article>) => void;
  removeArticle: (id: string) => void;
  /**
   * 承認済み記事の公開待ちキューから、その日まだ公開していなければ1件だけ公開する。
   * バックエンドを持たないプロトタイプのため、アプリを開いたタイミングで
   * 「前回公開から1日以上経過しているか」を判定して実行する(本番運用ではサーバー側のスケジューラを想定)。
   */
  runAutoPublishIfNeeded: () => void;
}

export const useArticleStore = create<ArticleState>()(
  persist(
    (set, get) => ({
      articles: [],
      lastAutoPublishDate: null,
      lastAutoPublishedArticleId: null,
      addArticle: (article) => set((state) => ({ articles: [article, ...state.articles] })),
      updateArticle: (id, patch) =>
        set((state) => ({
          articles: state.articles.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      removeArticle: (id) =>
        set((state) => ({ articles: state.articles.filter((a) => a.id !== id) })),
      runAutoPublishIfNeeded: () => {
        const today = todayDateString();
        const { articles, lastAutoPublishDate } = get();
        // 同じ日にすでに実行済みなら何もしない(StrictModeによる effect の二重実行でも
        // lastAutoPublishedArticleId を null で上書きしてバナーが消えないようにするため)。
        if (lastAutoPublishDate === today) return;
        const result = runDailyAutoPublish(articles, lastAutoPublishDate, today);
        set({
          articles: result.articles,
          lastAutoPublishDate: result.lastAutoPublishDate,
          lastAutoPublishedArticleId: result.publishedId,
        });
      },
    }),
    {
      name: "uchicare-articles",
      skipHydration: true,
      partialize: (state) => ({ articles: state.articles, lastAutoPublishDate: state.lastAutoPublishDate }),
    }
  )
);
