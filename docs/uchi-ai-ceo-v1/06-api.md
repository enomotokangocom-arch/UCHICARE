# API一覧

## Phase 0(実装対象)

Phase 0はバックエンドを持たず、集計・予測・Decision生成はすべてブラウザ内(`src/lib/ceo/*`)で
同期的に実行される。サーバーサイドAPIはLLM文章生成のみ。

| Method | Path | 説明 |
|---|---|---|
| POST | `/api/ceo/explain` | Decisionの集計値(匿名化済み)を渡し、説明文(reasoningSummary/recommendedAction/expectedImpact)をLLMで生成。キー未設定時は500、クライアント側でフォールバック |

CSVアップロード・モックデータ読込・Decision生成・承認/却下はすべてクライアントサイド処理
(`store.ts` のZustandアクション)であり、専用APIを持たない。

## Phase 1以降(拡張ポイント、未実装)

独立バックエンド化した場合に必要となるAPI一覧(設計の受け皿として記録)。

| Method | Path | 説明 |
|---|---|---|
| GET | `/api/v1/organizations/:id/dashboard` | CEOダッシュボード集計取得 |
| GET/POST | `/api/v1/organizations/:id/decisions` | Decision一覧取得・生成トリガー |
| PATCH | `/api/v1/decisions/:id/approve` | Decision承認 |
| PATCH | `/api/v1/decisions/:id/reject` | Decision却下 |
| POST | `/api/v1/decisions/:id/actions` | Decision実行(L3以上、`decision_actions`記録) |
| GET | `/api/v1/organizations/:id/forecasts` | Forecast一覧(売上/利益/利用者) |
| GET | `/api/v1/branches/:id/utilization` | 拠点稼働率 |
| GET | `/api/v1/employees/:id/productivity` | 職員別生産性 |
| GET | `/api/v1/referral-sources/ranking` | 営業先優先順位(RSS) |
| POST | `/api/v1/data-imports/csv` | CSV取込(バッチ) |
| GET | `/api/v1/audit-logs` | 監査ログ検索 |
| POST | `/api/v1/notifications/subscribe` | 通知購読設定(P0〜P3) |
| POST | `/api/v1/webhooks/data-source` | 外部データソース(勤怠/会計SaaS等)からの取込Webhook |

いずれも `organization_id` によるテナント分離・RBAC・監査ログ記録を必須とする(12章)。
