"use client";

import { FormEvent, useState } from "react";
import { useArticleStore } from "@/lib/articleStore";
import { generateArticle } from "@/lib/articleClient";
import {
  Article,
  ArticleGenerationInput,
  ArticleStatus,
  ArticleTopicCategory,
  ARTICLE_TOPIC_CATEGORY_DEFS,
  LENGTH_HINT_DEFS,
  TargetAudience,
  TARGET_AUDIENCE_DEFS,
} from "@/lib/articleTypes";

const AUDIENCE_OPTIONS = Object.entries(TARGET_AUDIENCE_DEFS) as [TargetAudience, (typeof TARGET_AUDIENCE_DEFS)[TargetAudience]][];
const TOPIC_OPTIONS = Object.entries(ARTICLE_TOPIC_CATEGORY_DEFS) as [ArticleTopicCategory, (typeof ARTICLE_TOPIC_CATEGORY_DEFS)[ArticleTopicCategory]][];
const LENGTH_OPTIONS = Object.entries(LENGTH_HINT_DEFS) as [ArticleGenerationInput["lengthHint"], (typeof LENGTH_HINT_DEFS)[ArticleGenerationInput["lengthHint"]]][];

const EMPTY_FORM: ArticleGenerationInput = {
  mainKeyword: "",
  subKeywords: [],
  targetAudiences: ["resident", "careManager"],
  topicCategory: "serviceIntro",
  lengthHint: "medium",
  notes: "",
};

export default function ArticlesPage() {
  const articles = useArticleStore((s) => s.articles);
  const addArticle = useArticleStore((s) => s.addArticle);
  const updateArticle = useArticleStore((s) => s.updateArticle);
  const removeArticle = useArticleStore((s) => s.removeArticle);

  const [form, setForm] = useState<ArticleGenerationInput>(EMPTY_FORM);
  const [subKeywordsText, setSubKeywordsText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAudience(audience: TargetAudience) {
    setForm((prev) => ({
      ...prev,
      targetAudiences: prev.targetAudiences.includes(audience)
        ? prev.targetAudiences.filter((a) => a !== audience)
        : [...prev.targetAudiences, audience],
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.mainKeyword.trim() || isGenerating) return;

    setError(null);
    setIsGenerating(true);
    const input: ArticleGenerationInput = {
      ...form,
      subKeywords: subKeywordsText
        .split(/[,、]/)
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      const generated = await generateArticle(input);
      const article: Article = {
        ...generated,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        status: "draft",
        mainKeyword: input.mainKeyword,
        subKeywords: input.subKeywords,
        targetAudiences: input.targetAudiences,
        topicCategory: input.topicCategory,
      };
      addArticle(article);
    } catch (err) {
      setError(err instanceof Error ? err.message : "記事の生成に失敗しました。");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">記事自動作成</h1>
        <p className="mt-1 text-sm text-slate-500">
          キーワードを指定してSEO記事を自動生成します。地域の方・ケアマネジャー・医師からの利用相談につながる記事作成を支援します。
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">メインキーワード</label>
            <input
              value={form.mainKeyword}
              onChange={(e) => setForm((p) => ({ ...p, mainKeyword: e.target.value }))}
              placeholder="例: ◯◯市 訪問看護"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">サブキーワード(カンマ区切り)</label>
            <input
              value={subKeywordsText}
              onChange={(e) => setSubKeywordsText(e.target.value)}
              placeholder="例: 在宅療養, 退院支援, 24時間対応"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">対象読者</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {AUDIENCE_OPTIONS.map(([key, def]) => {
              const active = form.targetAudiences.includes(key);
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => toggleAudience(key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-slate-300 bg-white text-slate-600 hover:border-teal-400"
                  }`}
                >
                  {def.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">記事カテゴリ</label>
            <select
              value={form.topicCategory}
              onChange={(e) => setForm((p) => ({ ...p, topicCategory: e.target.value as ArticleTopicCategory }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            >
              {TOPIC_OPTIONS.map(([key, def]) => (
                <option key={key} value={key}>
                  {def.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">文字数の目安</label>
            <select
              value={form.lengthHint}
              onChange={(e) =>
                setForm((p) => ({ ...p, lengthHint: e.target.value as ArticleGenerationInput["lengthHint"] }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            >
              {LENGTH_OPTIONS.map(([key, def]) => (
                <option key={key} value={key}>
                  {def.label}({def.chars})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">補足指示(任意)</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            rows={2}
            placeholder="例: 夜間対応の安心感を強調してほしい"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isGenerating || !form.mainKeyword.trim()}
          className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {isGenerating ? "生成中..." : "記事を生成する"}
        </button>
      </form>

      <div className="mt-8">
        <h2 className="text-sm font-bold text-slate-900">
          生成した記事({articles.length}件)
        </h2>
        {articles.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">まだ記事がありません。上のフォームから作成してください。</p>
        ) : (
          <div className="mt-3 space-y-4">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onUpdate={(patch) => updateArticle(article.id, patch)}
                onRemove={() => removeArticle(article.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ArticleCard({
  article,
  onUpdate,
  onRemove,
}: {
  article: Article;
  onUpdate: (patch: Partial<Article>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  function toggleStatus() {
    const next: ArticleStatus = article.status === "draft" ? "published" : "draft";
    onUpdate({ status: next });
  }

  async function handleCopy() {
    const fullText = `${article.title}\n\n${article.body}\n\n${article.callToAction}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                article.status === "published"
                  ? "bg-teal-50 text-teal-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {article.status === "published" ? "公開" : "下書き"}
            </span>
            <span className="text-[11px] text-slate-400">
              {new Date(article.createdAt).toLocaleString("ja-JP")}
            </span>
          </div>
          <input
            value={article.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="mt-1.5 w-full truncate border-none p-0 text-base font-bold text-slate-900 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-500">{article.metaDescription}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {article.targetKeywords.map((kw) => (
              <span key={kw} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {kw}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {expanded ? "閉じる" : "本文を見る"}
          </button>
          <button
            onClick={toggleStatus}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {article.status === "draft" ? "公開にする" : "下書きに戻す"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 px-5 py-4">
          <label className="text-xs font-semibold text-slate-600">本文(Markdown)</label>
          <textarea
            value={article.body}
            onChange={(e) => onUpdate({ body: e.target.value })}
            rows={14}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs leading-relaxed focus:border-teal-500 focus:outline-none"
          />

          <label className="mt-3 block text-xs font-semibold text-slate-600">行動喚起(CTA)</label>
          <textarea
            value={article.callToAction}
            onChange={(e) => onUpdate({ callToAction: e.target.value })}
            rows={2}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs leading-relaxed focus:border-teal-500 focus:outline-none"
          />

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
            >
              {copied ? "コピーしました" : "本文をコピー"}
            </button>
            <button
              onClick={onRemove}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              削除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
