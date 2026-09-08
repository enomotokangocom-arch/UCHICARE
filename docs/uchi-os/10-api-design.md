# 10. API設計

Next.js の Route Handlers（`src/app/api/uchi-os/**`）による REST API を基本とする。
全エンドポイントは認証必須（セッションから `organizationId` を解決）。応答は原則JSON。

規約:
- ページネーション: `?page=&pageSize=`
- 期間指定: `?yearMonth=2026-08` または `?from=&to=`
- エラー形式: `{ error: { code, message } }`

## 10.1 認証

| Method | Path | 説明 |
|---|---|---|
| POST | `/api/uchi-os/auth/login` | ログイン |
| POST | `/api/uchi-os/auth/logout` | ログアウト |
| GET | `/api/uchi-os/auth/session` | 現在のセッション/ユーザー情報取得 |

## 10.2 組織・拠点・設定

| Method | Path | 説明 |
|---|---|---|
| GET/PATCH | `/api/uchi-os/organization` | 組織情報取得/更新 |
| GET/POST | `/api/uchi-os/stations` | 拠点一覧取得/新規登録 |
| GET/PATCH | `/api/uchi-os/stations/:id` | 拠点詳細/更新 |
| GET/POST | `/api/uchi-os/users` | ユーザー一覧/招待 |
| PATCH | `/api/uchi-os/users/:id` | ロール変更等 |
| GET/PATCH | `/api/uchi-os/thresholds` | Decision Rule閾値の取得/更新（`?stationId=`で拠点別上書き） |

## 10.3 CEO Morning / Health Score

| Method | Path | 説明 |
|---|---|---|
| GET | `/api/uchi-os/ceo-morning` | 当日のTop5 Decision + Health Score をまとめて返す（CEO Morning画面専用の集約API） |
| GET | `/api/uchi-os/health-score?yearMonth=` | Health Scoreと内訳（売上/利益/生産性/営業/採用/組織/キャッシュ）、前月比 |

## 10.4 KPI / Dashboard

| Method | Path | 説明 |
|---|---|---|
| GET | `/api/uchi-os/kpi?kpiCode=&stationId=&from=&to=` | KPI時系列取得 |
| GET | `/api/uchi-os/dashboard/company?yearMonth=` | Company Dashboard集約データ |
| GET | `/api/uchi-os/dashboard/station/:stationId?yearMonth=` | Station Dashboard集約データ |
| GET | `/api/uchi-os/dashboard/financial?yearMonth=` | Financial Dashboard集約データ |
| GET | `/api/uchi-os/dashboard/sales?yearMonth=` | Sales Dashboard集約データ |
| GET | `/api/uchi-os/dashboard/workforce?yearMonth=` | Workforce Dashboard集約データ |

## 10.5 Alert / Decision / Action

| Method | Path | 説明 |
|---|---|---|
| GET | `/api/uchi-os/alerts?status=&severity=&stationId=` | Alert一覧 |
| PATCH | `/api/uchi-os/alerts/:id` | ステータス変更（Acknowledge/Resolve/Dismiss） |
| GET | `/api/uchi-os/decisions?status=&priority=` | Decision一覧 |
| GET | `/api/uchi-os/decisions/:id` | Decision詳細（rootCause内訳、関連AIInsight、関連Action） |
| PATCH | `/api/uchi-os/decisions/:id` | Dismiss等のステータス変更 |
| GET | `/api/uchi-os/actions?status=&ownerUserId=` | Action一覧（Action Center用） |
| GET | `/api/uchi-os/actions/:id` | Action詳細 |
| POST | `/api/uchi-os/actions/:id/approve` | 承認（重要判断カテゴリは追加確認必須、Audit Log記録） |
| POST | `/api/uchi-os/actions/:id/modify` | Owner/Deadline/内容の修正 |
| POST | `/api/uchi-os/actions/:id/hold` | 保留（理由付き） |
| POST | `/api/uchi-os/actions/:id/status` | ステータス更新（In Progress/Completed） |
| POST | `/api/uchi-os/actions/:id/verify` | 実績（actualImpact）記録 → Result Verified |

## 10.6 AI経営参謀チャット

| Method | Path | 説明 |
|---|---|---|
| POST | `/api/uchi-os/chat` | 質問文を受け取り、KPI/Decision Engineから関連データを取得した上でLLMへ渡し、結論→根拠→数値→リスク→推奨Action形式の回答を返す（ストリーミング対応） |
| GET | `/api/uchi-os/chat/history` | 直近の会話履歴取得 |

## 10.7 Scenario Simulator

| Method | Path | 説明 |
|---|---|---|
| POST | `/api/uchi-os/scenarios` | シナリオ作成・計算実行（`inputParams`を受け取りCalculation Engineで3ヶ月後予測を返す） |
| GET | `/api/uchi-os/scenarios/:id` | シナリオ結果取得 |
| GET | `/api/uchi-os/scenarios` | 過去シナリオ一覧 |

## 10.8 Data Import

| Method | Path | 説明 |
|---|---|---|
| POST | `/api/uchi-os/import/:entity` | CSV/Excelアップロード（`entity`は`financial_monthly`等）。バリデーション後 `DataImportBatch` 作成 |
| GET | `/api/uchi-os/import/batches` | インポート履歴・エラー詳細一覧 |
| GET | `/api/uchi-os/import/templates/:entity` | 各entityのCSVテンプレートダウンロード |

## 10.9 内部バッチ用エンドポイント（Cron専用、外部非公開）

| Method | Path | 説明 |
|---|---|---|
| POST | `/api/uchi-os/internal/jobs/kpi-recompute` | KPI Engine実行（Cron起動） |
| POST | `/api/uchi-os/internal/jobs/anomaly-scan` | Rule Engine実行 → Alert生成 |
| POST | `/api/uchi-os/internal/jobs/decision-generate` | Decision Engine + LLM Reasoning Layer実行 |

内部バッチ用エンドポイントは、Cronからの呼び出し専用シークレットヘッダで保護し、通常ユーザーの
セッション認証とは別経路で保護する。
