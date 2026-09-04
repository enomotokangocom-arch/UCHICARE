import Link from "next/link";
import { surveyList } from "@/lib/surveyDefs";
import { surveyTypeToSlug } from "@/lib/surveySlug";

const PILLARS = [
  {
    title: "労働環境(エルゴノミクス)",
    role: "療法士監修",
    description: "作業姿勢・設備・動線を療法士の視点で評価し、身体的負担を可視化します。",
  },
  {
    title: "ミニストレスチェック",
    role: "保健師監修",
    description: "職業性ストレス簡易調査票の考え方をもとにした短時間版で、心の健康状態を把握します。",
  },
  {
    title: "腰痛リスク調査",
    role: "療法士監修",
    description: "介助・重量物作業などによる腰痛リスクを定量評価し、予防策の優先度を明確にします。",
  },
  {
    title: "介護リスク調査",
    role: "ケアマネジャー監修",
    description: "従業員の家族介護と仕事の両立状況を把握し、介護離職リスクを早期に発見します。",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 p-8 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-100">
          健康経営 データ可視化ツール
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          保健師・療法士・ケアマネジャーが監修する
          <br />
          企業の健康経営指標を、ひとつのダッシュボードに。
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-teal-50">
          労働環境・ストレスチェック・腰痛リスク・介護リスクの4つの視点を統合し、
          企業の健康経営の課題をデータで捉え、チャットで手軽に相談できます。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50"
          >
            ダッシュボードを見る
          </Link>
          <Link
            href="/chat"
            className="rounded-lg border border-teal-300 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
          >
            企業課題をチャットで相談する
          </Link>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">新機能</p>
            <h2 className="mt-1 text-sm font-bold text-slate-900">Uchi AI CEO — 訪問看護事業のAI経営OS(Phase 0)</h2>
            <p className="mt-1 text-sm text-slate-500">
              売上・利益予測、生産性、必要新規利用者数・営業量・採用人数をAIが常時監視し、
              「今日CEOが判断すべきこと」だけを提示します。
            </p>
          </div>
          <Link
            href="/ceo"
            className="whitespace-nowrap rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Uchi AI CEOを開く →
          </Link>
        </div>
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-slate-400">
        4つの評価軸
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PILLARS.map((pillar, index) => {
          const survey = surveyList[index];
          return (
            <div
              key={pillar.title}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{survey.icon}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                  {pillar.role}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900">{pillar.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                {pillar.description}
              </p>
              <Link
                href={`/survey/${surveyTypeToSlug(survey.type)}`}
                className="mt-3 inline-block text-sm font-semibold text-teal-700 hover:underline"
              >
                調査票に回答する →
              </Link>
            </div>
          );
        })}
      </div>

      <div className="mt-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">利用の流れ</h2>
        <ol className="mt-4 grid grid-cols-1 gap-4 text-sm text-slate-600 sm:grid-cols-4">
          <li>
            <p className="text-xs font-semibold text-teal-700">STEP 1</p>
            <p className="mt-1">従業員が4つの調査票に回答</p>
          </li>
          <li>
            <p className="text-xs font-semibold text-teal-700">STEP 2</p>
            <p className="mt-1">回答が自動でスコア化・集計</p>
          </li>
          <li>
            <p className="text-xs font-semibold text-teal-700">STEP 3</p>
            <p className="mt-1">ダッシュボードで指標を可視化</p>
          </li>
          <li>
            <p className="text-xs font-semibold text-teal-700">STEP 4</p>
            <p className="mt-1">チャットで課題を相談・深掘り</p>
          </li>
        </ol>
      </div>
    </div>
  );
}
