# アーキテクチャ設計

## 技術選定の方針転換(重要)

オリジナル仕様は `apps/{web,api}` + `packages/{domain,decision-engine,forecast-engine,ai,shared}` の
モノレポ + FastAPI/NestJS + PostgreSQL + Redis を推奨技術としている。

一方このリポジトリ(UCHICARE)は既に **Next.js(App Router) + TypeScript + Zustand(localStorage永続化) +
Tailwind + `@anthropic-ai/sdk`** で構築された、バックエンドを持たないフロントエンド専用プロトタイプが
稼働中(健康経営ダッシュボード等)である。既存資産・命名規則・依存関係を壊さずPhase 0を最短で動かすため、
以下のとおり技術選定を調整する(仕様書 5章「合理的な理由がある場合は変更してよい」に基づく判断)。

| レイヤ | オリジナル仕様 | Phase 0 実装(本リポジトリ) | Phase 1以降 |
|---|---|---|---|
| Frontend | Next.js | 既存Next.js App Routerに `/ceo` 配下として追加 | 変更なし |
| Backend / API | FastAPI or NestJS | Next.js Route Handlers (`src/app/api/ceo/*`)。数値計算はサーバーを介さずクライアント側 `packages相当` (`src/lib/ceo/*`) の決定的ロジックで実行し、APIはLLM説明生成のみに限定 | 独立バックエンド(FastAPI等)へ切り出し、`src/lib/ceo` のロジックをそのまま移植可能な形で分離済み |
| DB | PostgreSQL | なし。CSVアップロード or モックデータを `localStorage` に永続化(Zustand persist) | PostgreSQL + Prisma/SQLAlchemy。`02-data-model.md` のスキーマをそのまま採用 |
| Cache/Queue | Redis | なし(Phase 0は同期計算のみ) | Redis(forecast再計算キュー、通知キュー) |
| Analytics | PostgreSQL + materialized view | ブラウザ内でのオンザフライ集計(データ量が小さいため) | Materialized view / ClickHouse |
| AI | LLM Provider abstraction | `@anthropic-ai/sdk` を1箇所(`src/lib/ceo/aiProvider.ts`)に隔離し、Provider差し替え可能なインターフェースのみ用意 | OpenAI/Gemini等を追加实装 |

**数値計算とLLMの分離は仕様書6章の要件通りPhase 0から厳守する**: Forecast/Decision Engineは100%
TypeScriptによる決定的ロジック(`src/lib/ceo/*Engine.ts`)。LLMは `reasoning_summary` や
`recommended_action` の自然文化・要約のみに用い、集計値そのものを生成させない。LLM未設定時は
テンプレート文で代替し、機能が壊れないようにする(既存 `/chat` `/articles` と同じフォールバック方針)。

## ディレクトリ構成(Phase 0)

```
src/
  app/
    ceo/
      page.tsx                # Uchi AI CEO ダッシュボード
    api/
      ceo/
        explain/route.ts      # LLMによる説明文生成(集計値のみ送信)
  components/
    ceo/
      CompanyHealthGauge.tsx
      DecisionCard.tsx
      ExplainModal.tsx
      ProcessedList.tsx
      DataSourcePanel.tsx     # CSVアップロード / サンプルデータ読込
      BranchTable.tsx
  lib/
    ceo/
      types.ts                # ドメイン型(02-data-model.md準拠)
      config.ts                # 閾値・パラメータ(config管理、ハードコード禁止)
      mockData.ts              # モック会社データ生成
      csv.ts                   # CSVパース/サンプルCSV書き出し
      forecastEngine.ts        # 売上・利益予測(決定的ロジック)
      productivityEngine.ts    # 生産性計算
      salesEngine.ts           # 必要新規/営業量/採用数
      companyScore.ts          # 総合スコア0-100
      decisionEngine.ts        # Decisionルール評価・優先順位付け
      aiProvider.ts             # LLM Provider abstraction
      explainClient.ts         # /api/ceo/explain クライアント + フォールバック
      store.ts                 # Zustand persist store + 監査ログ
docs/
  uchi-ai-ceo-v1/              # 本設計ドキュメント一式
```

Phase 1で独立バックエンドへ切り出す際は、`src/lib/ceo/*Engine.ts` を `packages/decision-engine` /
`packages/forecast-engine` にほぼそのまま移植できるよう、**Next.js固有API(fetch, React state)に依存しない
純粋関数**として実装する(下記「実装ルール」参照)。

## 実装ルール(仕様書20章準拠)

- 巨大ファイルを作らない: 1ファイル1責務、各Engineは200行程度を目安に分割
- Domain logicをUIから分離: `src/lib/ceo/*` に計算ロジックを集約し、コンポーネントは呼び出すだけ
- AI logicをbusiness logicと分離: `aiProvider.ts` / `explainClient.ts` 以外の `*Engine.ts` はLLMに一切依存しない
- 数値計算はdeterministicにする: `Math.random()` を使わず、既存 `mulberry32` パターンを踏襲
- 型安全性を重視: `types.ts` に全ドメイン型を定義し `any` を使わない
- ThresholdはDBまたはconfig管理: `config.ts` に閾値を集約(ハードコード禁止)
- multi-tenantを最初から意識: 全エンティティに `organizationId` を保持(Phase 0はシングルテナント固定値だが型は保持)
- auditabilityを最初から組み込む: `store.ts` に承認・却下の監査ログ配列を保持
- explainabilityを必須とする: 各Decisionに使用データ・計算式・主要因・信頼度を保持し `ExplainModal` で表示
