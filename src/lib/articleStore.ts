import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Article } from "./articleTypes";

interface ArticleState {
  articles: Article[];
  addArticle: (article: Article) => void;
  updateArticle: (id: string, patch: Partial<Article>) => void;
  removeArticle: (id: string) => void;
}

export const useArticleStore = create<ArticleState>()(
  persist(
    (set) => ({
      articles: [],
      addArticle: (article) => set((state) => ({ articles: [article, ...state.articles] })),
      updateArticle: (id, patch) =>
        set((state) => ({
          articles: state.articles.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      removeArticle: (id) =>
        set((state) => ({ articles: state.articles.filter((a) => a.id !== id) })),
    }),
    {
      name: "uchicare-articles",
      skipHydration: true,
    }
  )
);
