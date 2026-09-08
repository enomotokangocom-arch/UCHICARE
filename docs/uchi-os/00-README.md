# Uchi OS 設計ドキュメント

「訪問看護経営者の意思決定をAI化する経営OS」— Uchi OS の設計一式です。
本ディレクトリは、コード実装に着手する前の**設計フェーズの成果物**です。
「Phase 1を実装してください」という明示的な指示を受けるまで、実装コードは書きません。

## 前提（重要な決定事項）

このリポジトリ (UCHICARE) は既に「企業向け健康経営ダッシュボード」という**別プロダクト**
（`src/app/dashboard`, `src/app/survey/*`, `src/app/articles` 等）が実装されています。
Uchi OS は訪問看護法人向けの経営意思決定OSであり、対象ユーザー・データモデル・保存すべき
機密度（患者データ・財務データ）が全く異なるため、**既存のUCHICAREコードとは名前空間を分離した
新プロダクト領域として同一リポジトリに追加する**方針とします。

- 画面: `src/app/uchi-os/**`（新規ルートグループ）
- サーバーロジック: `src/server/uchi-os/**`
- DBスキーマ: 別スキーマ（`uchi_os` schema）または別テーブルプレフィックス
- 既存のUCHICARE機能（健康経営ダッシュボード）は変更しない

この前提は本ドキュメント群全体に反映されています。別リポジトリでの新規開発を意図している場合は
指示してください。

## ドキュメント一覧

| # | ファイル | 内容 |
|---|---|---|
| 1 | [01-prd.md](./01-prd.md) | PRD（プロダクト要求仕様） |
| 2 | [02-mvp-scope.md](./02-mvp-scope.md) | MVP Scope（Phase 1〜4の範囲定義） |
| 3 | [03-user-journey.md](./03-user-journey.md) | User Journey |
| 4 | [04-system-architecture.md](./04-system-architecture.md) | System Architecture |
| 5 | [05-database-schema.md](./05-database-schema.md) | Database Schema |
| 6 | [06-kpi-definitions.md](./06-kpi-definitions.md) | KPI Definition Table |
| 7 | [07-decision-rules.md](./07-decision-rules.md) | 20 Decision Rules |
| 8 | [08-ai-architecture.md](./08-ai-architecture.md) | AI Architecture |
| 9 | [09-security-architecture.md](./09-security-architecture.md) | Security Architecture |
| 10 | [10-api-design.md](./10-api-design.md) | API設計 |
| 11 | [11-screens.md](./11-screens.md) | 画面一覧 |
| 12 | [12-ceo-morning-wireframe.md](./12-ceo-morning-wireframe.md) | CEO Morning Wireframe |
| 13 | [13-tech-stack.md](./13-tech-stack.md) | Technology Stack |
| 14 | [14-repository-structure.md](./14-repository-structure.md) | Repository Structure |
| 15 | [15-phase1-plan.md](./15-phase1-plan.md) | Phase 1 実装計画 |

## 開発順序

Phase 1 → Phase 2 → Phase 3 → Phase 4（詳細は [02-mvp-scope.md](./02-mvp-scope.md)）。
「Phase 1を実装してください」の指示を受けたら、[15-phase1-plan.md](./15-phase1-plan.md) に
従って実装を開始します。
