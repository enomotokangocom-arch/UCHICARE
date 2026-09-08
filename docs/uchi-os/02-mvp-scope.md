# 2. MVP Scope

25章の開発方針に基づき、4フェーズに分割する。各フェーズは独立してデモ可能な状態を目指す。

## Phase 1 — 土台（データ・KPI・CEO Morning）

**目的**: サンプルデータを入れるだけで CEO Morning が動く状態を作る。

含む:
- データモデル（05-database-schema.md 全Entity）
- CSV / Excel Import（手入力含む）
- KPI Engine（決定論的計算、06-kpi-definitions.md 全KPI）
- CEO Morning 画面（静的ルールでのTop5表示。この時点ではAlert Engine/Decision Engineの簡易版）
- Company Dashboard / Station Dashboard / Financial Dashboard / Workforce Dashboard（閲覧のみ）
- 3拠点サンプル法人 + 12ヶ月ダミーデータ生成スクリプト
- 認証・RBAC の最小実装（Owner / Station Manager）
- Tenant Isolation・Audit Logの基盤

含まない:
- LLMによる原因分析・自然言語チャット（Phase3）
- Action の承認ワークフロー全ステータス（Phase2で本実装、Phase1は表示のみのモック）
- 将来予測（Forecast Engineの本実装はPhase3、Phase1は簡易トレンド表示のみ）
- Scenario Simulator（Phase3）

## Phase 2 — Alert / Decision / Action

含む:
- Anomaly / Rule Engine（20 Decision Rules 実装、07-decision-rules.md）
- Alert 画面、Alert→Decision→Action への変換
- AI Decisions 画面、Action Center 画面
- Action の状態遷移（Draft → AI Recommended → Human Approved → In Progress → Completed → Result Verified）
- 重要判断カテゴリ（採用/解雇/給与/人事評価/投資/借入/契約/出店/撤退）への強制承認フラグ
- Decision Engine（ルール発火 → 原因分析の決定論部分 → Action候補の下書き生成、LLM未接続の場合はテンプレート文）

含まない:
- LLMによる自然文の原因説明生成（Phase3で接続、Phase2ではテンプレート/数値ベースの説明で代替可）

## Phase 3 — AI経営参謀 Chat / Forecast / Scenario Simulator

含む:
- LLM Reasoning Layer 本接続（Claude API）。Decision Engineの出力をLLMが自然文化
- AI経営参謀チャット（12章のQAパターン、結論→根拠→数値→リスク→推奨Actionの順で応答）
- Forecast Engine（月末/翌月/3ヶ月後売上予測、利用者数予測、必要看護師数、人件費予測、営業利益予測、Cash Runway）
- Scenario Simulator（What-if：採用/退職/利用者増減/単価変更/新規出店/給与アップ/インセンティブ変更）
- FACT / CALCULATED / AI ESTIMATE のUI区別を全画面に適用

含まない:
- Feedback Loopの学習ロジック本実装（Phase4）
- 外部システムとの自動API連携（Phase4のAdapter Layer）

## Phase 4 — Feedback Loop / External API / Automation

含む:
- Action の Expected Impact vs Actual Impact 記録・検証
- 「このAction/この法人にとって成果につながりやすいパターン」の分析基盤
- 外部システム（レセプト・勤怠・会計等）との連携 Adapter Layer
- 通知・自動化（Slack/メール通知、定期レポート自動送信 等）

## Phase1 Definition of Done

> 「経営者が朝ログインして5分以内に、会社の状態・異常・原因・今日判断すべきことを理解できる」

具体的な合格基準:

1. サンプル企業（3拠点訪問看護法人、12ヶ月ダミーデータ）でログインできる
2. CEO Morning に Uchi OS Score（0〜100、内訳付き）が表示される
3. 少なくとも1件、異常状態（例: ある拠点の売上低下）が「今日判断すべきこと」として表示される
4. その項目に「主な原因」「予測影響」「推奨Action」が数値と共に表示される（Phase1時点ではテンプレート/計算ベースの文言で可、LLM接続は必須としない）
5. Company / Station / Financial / Workforce Dashboard に遷移でき、KPIが正しく計算・表示される
6. スマートフォン幅（375px）で CEO Morning が崩れずに表示される
7. すべての業務データが `organization_id` でテナント分離されている（他社データが混在しない）
