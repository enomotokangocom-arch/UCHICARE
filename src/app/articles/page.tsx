"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useArticleStore } from "@/lib/articleStore";
import { generateArticle } from "@/lib/articleClient";
import { estimateQueuePosition, todayDateString } from "@/lib/publishScheduler";
import { computeSeoScore, SEO_APPROVAL_THRESHOLD } from "@/lib/seoScore";
import {
  ARTICLE_STATUS_LABELS,
  Article,
  ArticleGenerationInput,
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
  const lastAutoPublishDate = useArticleStore((s) => s.lastAutoPublishDate);
  const lastAutoPublishedArticleId = useArticleStore((s) => s.lastAutoPublishedArticleId);
  const addArticle = useArticleStore((s) => s.addArticle);
  const updateArticle = useArticleStore((s) => s.updateArticle);
  const removeArticle = useArticleStore((s) => s.removeArticle);
  const runAutoPublishIfNeeded = useArticleStore((s) => s.runAutoPublishIfNeeded);

  const [form, setForm] = useState<ArticleGenerationInput>(EMPTY_FORM);
  const [subKeywordsText, setSubKeywordsText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // アプリを開いたタイミングで、前回公開日から1日以上経過していれば
  // 承認済みキューの先頭(SEOスコア90点以上)を1件だけ自動公開する。
  useEffect(() => {
    runAutoPublishIfNeeded();
  }, [runAutoPublishIfNeeded]);

  const autoPublishedArticle = useMemo(
    () => articles.find((a) => a.id === lastAutoPublishedArticleId) ?? null,
    [articles, lastAutoPublishedArticleId]
  );

  const approvedQueueCount = useMemo(
    () => articles.filter((a) => a.status === "approved").length,
    [articles]
  );

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
        approvedAt: null,
        publishedAt: null,
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

      {autoPublishedArticle && (
        <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          本日、承認済みキューから「{autoPublishedArticle.title}」を自動公開しました。
        </div>
      )}

      <div className="mb-6 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        承認済み記事はSEOスコア{SEO_APPROVAL_THRESHOLD}点以上のものに限り、公開待ちキューに入り、1日1件ずつ自動で公開されます(承認日時が古い順)。
        現在、公開待ちキューに{approvedQueueCount}件あります。
        <br />
        ※ このプロトタイプはバックエンドを持たないため、アプリを開いたタイミングで「前回公開から1日以上経過したか」を判定して実行します(本番運用ではサーバー側の日次スケジューラでの実行を想定)。
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
                articles={articles}
                lastAutoPublishDate={lastAutoPublishDate}
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
  articles,
  lastAutoPublishDate,
  onUpdate,
  onRemove,
}: {
  article: Article;
  articles: Article[];
  lastAutoPublishDate: string | null;
  onUpdate: (patch: Partial<Article>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const { score, checks } = useMemo(() => computeSeoScore(article), [article]);
  const meetsThreshold = score >= SEO_APPROVAL_THRESHOLD;

  // 承認後に本文を編集してスコアが基準を下回った場合は、承認を取り消して下書きに戻す。
  useEffect(() => {
    if (article.status === "approved" && !meetsThreshold) {
      onUpdate({ status: "draft", approvedAt: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.status, meetsThreshold]);

  const queueInfo = useMemo(
    () =>
      article.status === "approved"
        ? estimateQueuePosition(articles, article.id, lastAutoPublishDate, todayDateString())
        : null,
    [articles, article.id, article.status, lastAutoPublishDate]
  );

  function handleApprove() {
    onUpdate({ status: "approved", approvedAt: new Date().toISOString() });
  }

  function handleRevoke() {
    onUpdate({ status: "draft", approvedAt: null });
  }

  function handlePublishNow() {
    onUpdate({ status: "published", publishedAt: todayDateString() });
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

  const scoreColor = score >= 90 ? "bg-teal-50 text-teal-700" : score >= 70 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  const statusColor =
    article.status === "published"
      ? "bg-teal-50 text-teal-700"
      : article.status === "approved"
        ? "bg-blue-50 text-blue-700"
        : "bg-slate-100 text-slate-500";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColor}`}>
              {ARTICLE_STATUS_LABELS[article.status]}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${scoreColor}`}>
              SEOスコア {score}点
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

          {article.status === "draft" && !meetsThreshold && (
            <p className="mt-2 text-[11px] text-red-600">
              SEOスコアが{SEO_APPROVAL_THRESHOLD}点未満のため承認できません。下の内訳を確認して本文を調整してください。
            </p>
          )}
          {article.status === "approved" && queueInfo && (
            <p className="mt-2 text-[11px] text-blue-700">
              公開待ちキュー {queueInfo.position}番目・公開予定日の目安 {queueInfo.estimatedDate}
            </p>
          )}
          {article.status === "published" && article.publishedAt && (
            <p className="mt-2 text-[11px] text-teal-700">公開日: {article.publishedAt}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {expanded ? "閉じる" : "詳細を見る"}
          </button>
          {article.status === "draft" && (
            <button
              onClick={handleApprove}
              disabled={!meetsThreshold}
              className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              承認する
            </button>
          )}
          {article.status === "approved" && (
            <>
              <button
                onClick={handlePublishNow}
                className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
              >
                今すぐ公開する
              </button>
              <button
                onClick={handleRevoke}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                承認を取り消す
              </button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 px-5 py-4">
          <div>
            <label className="text-xs font-semibold text-slate-600">SEOチェック内訳</label>
            <ul className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {checks.map((check) => (
                <li
                  key={check.key}
                  className={`flex items-center gap-1.5 text-xs ${check.passed ? "text-slate-600" : "text-red-600"}`}
                >
                  <span>{check.passed ? "✓" : "✗"}</span>
                  <span>
                    {check.label}({check.weight}点)
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <label className="mt-4 block text-xs font-semibold text-slate-600">本文(Markdown)</label>
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
