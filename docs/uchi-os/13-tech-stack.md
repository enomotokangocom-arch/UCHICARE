# 13. Technology Stack

## 13.1 既存リポジトリとの関係（重要）

本リポジトリの既存プロダクト（UCHICARE健康経営ダッシュボード）は、バックエンドを持たず
`localStorage` にデータを保存するプロトタイプ構成（`src/lib/store.ts`, Zustand + persist）。

Uchi OS はマルチテナントSaaSであり、複数ユーザー・複数拠点間でのデータ共有、財務・患者関連データの
永続化とテナント分離、RBAC・Audit Logが必須要件（09章）のため、**`localStorage` 完結の構成は使えない**。
Next.js + React のフロントエンド資産は共有しつつ、Uchi OSでは実データベース（PostgreSQL）を持つ
バックエンドを新設する。この点は既存パターンからの明確な逸脱であり、意図的な決定として記録する。

## 13.2 フロントエンド

| 項目 | 選定 | 理由 |
|---|---|---|
| フレームワーク | Next.js (App Router) + TypeScript | 既存リポジトリと統一、React Server Componentsでダッシュボードの初期表示を高速化 |
| スタイリング | Tailwind CSS | 既存リポジトリと統一 |
| UIコンポーネント | shadcn/ui（Radix UIベース） | Minimal/Premiumなデザイン方針（19章）に適合し、カスタマイズ性が高い |
| グラフ | Recharts（既存踏襲）、必要に応じ軽量化のためvisx検討 | 既存資産の再利用 |
| 状態管理 | React Query（サーバー状態）+ 軽量なローカルUI状態はReact標準state | サーバーが正となるデータのキャッシュ・再検証に適する（既存のZustand+persistパターンはUIの一時状態のみに限定使用） |
| フォーム | react-hook-form + zod | Data Import・Settings等のバリデーションが多い画面向け |

## 13.3 バックエンド

| 項目 | 選定 | 理由 |
|---|---|---|
| API層 | Next.js Route Handlers（10章のAPI設計） | フロントと同一リポジトリ・同一デプロイで完結、MVPのスピード優先 |
| ORM | Prisma | 05章のスキーマをそのままマイグレーション管理でき、型安全 |
| DB | PostgreSQL（マネージドサービス、例: Supabase / Neon / RDS） | RLS（09章）が使え、マルチテナントSaaSの実績が豊富 |
| 認証 | NextAuth（Auth.js）or Clerk | セッション管理・RBAC実装のスピード。医療系のため将来的にSSO/MFA要件が出た場合の拡張性も考慮 |
| バリデーション | zod（API入出力共通） | フロントと共有可能 |
| ファイル解析（Import） | `csv-parse`（CSV）、`xlsx`（SheetJS、Excel） | 14章のCSV/Excel/手入力要件に対応 |
| ジョブ/バッチ | Vercel Cron（または任意のスケジューラ）+ 内部API（10.9節） | 日次KPI再計算・異常検知・Decision生成 |
| キュー（将来） | Phase1-2は同期処理で十分な想定。データ量増加時にRedis/BullMQ等を検討 | MVPでは過剰実装を避ける |

## 13.4 AI

| 項目 | 選定 | 理由 |
|---|---|---|
| LLM API | Anthropic Claude API（`@anthropic-ai/sdk`、既存リポジトリで利用実績あり） | 8章のAI Architectureに準拠し、原因説明・チャット・Action候補生成に利用 |
| オーケストレーション | 自前の薄いレイヤー（プロンプトテンプレート + Data Sanitizer + 構造化出力パース） | LangChain等の汎用フレームワークは「LLMに計算させない」という設計原則との相性・デバッグ容易性を優先し、Phase3時点では採用しない。将来Multi-Agent化する際に再検討 |

## 13.5 インフラ・運用

| 項目 | 選定 | 理由 |
|---|---|---|
| ホスティング | Vercel（フロント+API） | Next.jsとの親和性、既存デプロイ想定を踏襲しやすい |
| DB | Supabase / Neon 等のマネージドPostgreSQL | RLS標準サポート、バックアップ・PITR対応 |
| オブジェクトストレージ | S3互換ストレージ | Data Importのアップロードファイル一時保管（9.6のRetention方針に従い30日で削除） |
| シークレット管理 | Vercel Environment Variables / 外部Secrets Manager | 09章 |
| 監視・エラートラッキング | Sentry | フロント/バックエンド共通 |
| ロギング | 構造化ログ（JSON） + Audit Logは別途DBテーブル | 運用監視とコンプライアンス監査を分離 |

## 13.6 テスト

| 項目 | 選定 |
|---|---|
| Unit / Integration | Vitest（Calculation Engine・KPI Engine・Rule Engineの決定論ロジックを重点的にテスト） |
| E2E | Playwright（既存リポジトリに導入済み） — CEO Morningの主要フロー（ログイン→カード確認→承認）を優先カバー |
| 型チェック | TypeScript strict mode、`tsc --noEmit` をCIに組み込み |

## 13.7 設計原則との対応関係

- Calculation Engine / KPI Engine / Rule Engine / Forecast Engine は **副作用のない純粋なTypeScript関数群**
  として実装し、LLMやDBアクセスと分離してユニットテスト可能にする（04章のレイヤー分離を技術選定でも徹底）
- LLM呼び出しは専用モジュール（例: `src/server/uchi-os/ai/`）に閉じ込め、他レイヤーから直接Anthropic SDKを
  呼び出せないようにする（8.4節のData Sanitizerを強制経由させるため）
