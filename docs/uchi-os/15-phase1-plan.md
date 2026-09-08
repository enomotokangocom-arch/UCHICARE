# 15. Phase 1 実装計画

Phase1のゴール（02-mvp-scope.md の Definition of Done 再掲）:

> 経営者が朝ログインして5分以内に、会社の状態・異常・原因・今日判断すべきことを理解できる

実装は「Phase 1を実装してください」という明示指示を受けてから開始する（27章）。
本章はその際の実行計画。

## 15.1 タスク分解

### T1. データモデル基盤
- `prisma/schema.prisma` に05章のスキーマを実装、マイグレーション作成
- RLSポリシーのマイグレーションSQL作成（09章）、`app.current_org_id` セッション変数を設定するPrisma拡張/ミドルウェア実装
- Prisma Client初期化 + テナントコンテキスト解決ヘルパー（`src/server/uchi-os/db/`, `auth/`）

### T2. 認証・RBAC最小実装
- NextAuth（or Clerk）でのログイン、Organization/Userとの紐付け
- `UserRole` に基づく最小限のAPIガード（Owner/Station Managerの2ロールから開始し、他ロールはPhase2で拡張）

### T3. Calculation Engine / KPI Engine
- 06章の全KPI式をTypeScript純粋関数として実装（`src/server/uchi-os/calculation-engine/`）
- ゼロ除算・欠損値処理（6.8節）をユニットテストで明示的に検証
- `kpi-engine` が `KPISnapshot` にupsertする処理を実装（内部ジョブAPI経由、Phase1は手動トリガーで可）

### T4. CSV/Excel Import
- 14章のentity（`financial_monthly`, `stations`, `employees`, `visits`, `patients`, `patient_events`,
  `sales_activities`, `referral_sources`, `recruitment`）ごとのテンプレート・バリデーションスキーマ（zod）
- アップロード→パース→バリデーション→`DataImportBatch`記録→正規化データ保存のパイプライン実装
- 手入力フォーム（最低限 `financial_monthly` と `stations` から着手）

### T5. CEO Morning（簡易版）
- Alert Engine/Decision Engine本実装はPhase2だが、Phase1のDoD達成のため「簡易ルール評価」を実装:
  - DR-01（売上低下）、DR-06（稼働率低下）、DR-17（Cash Runway低下）の3ルールのみ、閾値固定でも可
  - 原因分解は6.7節の追加KPIを使い、テンプレート文言で生成（LLM接続はPhase1では任意、
    `AIInsight`は空でも良いがUIの表示形式・バッジ区分は最終形に合わせて実装しておく）
- `HealthScoreCard`（加重スコア計算、5章参照）と `TodayDecisionCard`（12章ワイヤーフレーム準拠）を実装
- FACT/CALCULATED/AI ESTIMATEバッジコンポーネントを最初から導入（後続フェーズでの後付けを避ける）

### T6. Dashboard群（閲覧のみ）
- Company / Station / Financial / Workforce Dashboard（Sales DashboardはPhase1簡易版、営業KPIのみ表示）
- Recharts/shadcnベースのグラフ・テーブル

### T7. サンプルデータ生成スクリプト
- `scripts/uchi-os/seed-sample-org.ts`
- 15.2節の仕様に従い、3拠点訪問看護法人 + 12ヶ月ダミーデータを生成
- 「正常状態→異常発生→Alert→原因分析→Decision→推奨Action」の一連の流れが再現できるよう、
  意図的に1拠点（例: 仙台東）の直近1-2ヶ月データに異常パターンを埋め込む

### T8. テスト
- Calculation/KPI Engine: Vitestでの単体テスト（境界値・ゼロ除算含む）
- E2E: Playwrightで「ログイン→CEO Morning表示→Top項目にCRITICALが表示される→詳細遷移」をカバー
- モバイル幅（375px）でのCEO Morning表示崩れがないことをPlaywrightのviewport指定で確認

## 15.2 サンプル企業データ仕様

**法人**: 3拠点の訪問看護法人（例: 東京中央・仙台東・大阪南）

| 拠点 | 特性 |
|---|---|
| 東京中央 | 安定成長。12ヶ月を通じて売上・稼働率とも横ばい〜微増。比較対象としての「正常系」 |
| 仙台東 | 直近1-2ヶ月に異常パターンを注入（下記）。CEO Morningで検知させる主役 |
| 大阪南 | 緩やかな成長。出店可能性（DR-19）を示せる程度に稼働率・利益率が良好 |

**異常パターン（仙台東、直近2ヶ月）**:
- 終了利用者が直近12ヶ月平均の1.5〜2倍に増加（DR-04発火）
- 新規利用者が直近3ヶ月平均の0.7倍以下に減少（DR-05発火）
- 上記の結果、`net_patient_change` が2ヶ月連続マイナス（DR-03発火）
- 稼働率が75%を下回る（DR-06発火）
- これらの複合効果として売上が前月比8%前後低下（DR-01発火、CEO Morningのサンプル文言と整合）

**データ量の目安（法人全体・12ヶ月）**:
- Employee: 各拠点8-15名（看護師中心、リハ職・事務職を一部含む）
- Patient: 各拠点30-60名（稼働中+終了済み含む）
- Visit: 月間総数1,500-3,000件相当（拠点・職員・利用者に按分生成）
- FinancialRecord: 拠点×12ヶ月 + 全社(stationId=null)×12ヶ月
- SalesActivity / ReferralSource: 拠点あたり紹介元10-20件、月間営業活動20-40件
- RecruitmentRecord: 各拠点1-3件（進行中/完了混在）

生成方法: 決定論的な乱数シード（例: `seedrandom` 等）を使い、再実行しても同じデータが得られるようにする
（デモ・テストの再現性のため）。

## 15.3 Phase1完了判定チェックリスト

- [ ] サンプル法人でログインできる
- [ ] CEO MorningにHealth Score（内訳付き）が表示される
- [ ] 仙台東の異常が「今日判断すべきこと」に少なくとも1件表示される
- [ ] そのカードに原因（FACT/CALCULATEDバッジ付き数値）と推奨Actionが表示される
- [ ] Company/Station/Financial/Workforce Dashboardに遷移でき、KPIが正しい値で表示される
- [ ] 375px幅でCEO Morningが崩れずに表示される（Playwrightで自動検証）
- [ ] 全テーブルが`organizationId`でテナント分離されており、別組織のダミーデータを追加しても混在しないことをテストで確認
- [ ] Vitestによる Calculation/KPI Engine の単体テストが通過（ゼロ除算・欠損値ケース含む）

## 15.4 Phase1で意図的に省略するもの（Phase2以降へ）

- LLMによる自然文の原因説明（テンプレート文言で代替可、8章の接続自体はPhase1で疎通確認までは行っても良い）
- Action の完全な状態遷移・承認モーダル（表示のみのモック可）
- Forecast Engineの本実装（トレンドの単純延長で代替）
- Scenario Simulator、AI経営参謀Chat本実装
- Audit LogのUI（記録自体はT1のRLS基盤と合わせて先行実装しておくと後続フェーズが楽になるため推奨）
