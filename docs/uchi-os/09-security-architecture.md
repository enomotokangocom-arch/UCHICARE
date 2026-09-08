# 9. Security Architecture

医療福祉領域のデータ（患者関連情報・財務情報）を扱うため、セキュリティを最重要要件とする。

## 9.1 RBAC（Role-Based Access Control）

`User.role`（05章）に基づく権限マトリクス。

| リソース/操作 | OWNER | ADMIN | STATION_MANAGER | SALES | HR | FINANCE | VIEWER |
|---|---|---|---|---|---|---|---|
| CEO Morning閲覧 | ✓ | ✓ | 自拠点のみ | △(営業関連のみ) | △(採用関連のみ) | △(財務関連のみ) | 閲覧のみ |
| Action承認（重要判断カテゴリ） | ✓ | ✓ | 自拠点の一部（HIRING除く） | ✗ | HIRING/TERMINATIONのみ | LOAN/INVESTMENTのみ | ✗ |
| Action承認（通常） | ✓ | ✓ | 自拠点分 | 営業系のみ | 採用系のみ | 財務系のみ | ✗ |
| Data Import | ✓ | ✓ | 自拠点分 | ✗ | 採用データのみ | 財務データのみ | ✗ |
| Settings（閾値変更） | ✓ | ✓ | 自拠点閾値のみ | ✗ | ✗ | ✗ | ✗ |
| ユーザー管理 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `PatientIdentity` アクセス | ✗（原則不要） | ✗ | ✗ | ✗ | ✗ | ✓（請求担当のみ、別途個別付与） | ✗ |
| Audit Log閲覧 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

- 実装は「Role × Resource × Action」の権限テーブルをコードで管理し、APIミドルウェアで一律チェックする
- `STATION_MANAGER` 等の拠点スコープロールは、`stationId` によるデータフィルタも同時に適用する（テナント分離とは別軸のスコープ制御）

## 9.2 Tenant Isolation

- **アプリ層**: 全DBクエリのfilterに `organizationId` を必須化するクエリビルダ/Prismaミドルウェアを実装し、
  `organizationId` を明示しないクエリはコードレビュー/lintルールで検出する
- **DB層（多層防御）**: PostgreSQL の Row Level Security (RLS) を全業務テーブルに設定。
  接続時に `SET app.current_org_id = '<organizationId>'` をセッション変数として設定し、
  `USING (organization_id = current_setting('app.current_org_id')::text)` ポリシーで強制する
- **ID衝突対策**: 全ID（`cuid()`）はグローバルに一意であり、他テナントのIDを類推できない
- **バックグラウンドジョブ**: 日次バッチ処理は組織ごとにループし、各イテレーションで確実にコンテキストを
  切り替える（前の組織のコンテキストが残留しないようトランザクション/スコープを明確化）

## 9.3 Audit Log

`AuditLog` テーブル（05章）に以下のイベントを最低限記録する。

| カテゴリ | 記録するaction例 |
|---|---|
| 認証 | `user.login`, `user.login_failed`, `user.logout` |
| 承認系 | `action.approve`, `action.reject`, `action.modify`, `decision.dismiss` |
| データ変更 | `data_import.upload`, `financial_record.update`, `patient.create/update/end` |
| 機密データアクセス | `patient_identity.access`（誰が・いつ・どの患者の識別情報を閲覧したか） |
| 権限変更 | `user.role_change`, `threshold.update` |

- Audit Logは**改ざん防止のため追記専用**（UPDATE/DELETE権限をアプリケーションDBユーザーに付与しない）
- 保持期間はData Retentionポリシー（9.6）に従う（医療関連の監査要件を踏まえ長期保持）

## 9.4 暗号化（Encryption）

| 対象 | 方式 |
|---|---|
| 通信 | TLS1.2+ 必須（HTTPS強制、HSTS） |
| 保存データ全般 | DBの透過的暗号化（TDE、マネージドPostgreSQLの標準機能を利用） |
| `PatientIdentity.encryptedName` 等 | アプリケーション層でのフィールドレベル暗号化（AES-256-GCM）。DB管理者がSQLを直接見ても復号できない設計 |
| バックアップ | 保存先も暗号化（同上のTDEまたはオブジェクトストレージ側の暗号化） |

## 9.5 Secret Management

- APIキー（Anthropic APIキー等）・DB接続情報・暗号化鍵は環境変数 + シークレットマネージャ
  （例: Vercel Environment Variables / AWS Secrets Manager 相当）で管理し、リポジトリにコミットしない
  （既存の `.env.local.example` パターンを踏襲、実キーはコミット禁止）
- フィールドレベル暗号化の鍵はDB接続情報とは別のシークレットストアで管理し、ローテーション手順を定義する
- 鍵ローテーション: 年1回を最低ラインとし、漏洩疑義があれば即時ローテーション

## 9.6 Data Retention（データ保持）

| データ種別 | 保持方針 |
|---|---|
| 業務データ（KPI/Visit/FinancialRecord等） | 契約継続中は無期限保持。解約後は法令・契約に基づく保持期間（例: 5年）経過後に削除 |
| `PatientIdentity` | 利用終了後、法定保存期間（診療録に準じ最低5年を目安、契約で調整）経過後に削除またはアーカイブ暗号化 |
| Audit Log | 最低3年保持（改ざん検知・インシデント調査のため） |
| Data Import アップロードファイル原本 | 取り込み成功後30日でオブジェクトストレージから削除（DBへの正規化データのみ残す） |
| AIInsight（LLM入出力ログ） | 監査目的で1年保持後、匿名化統計のみ残しレコードは削除 |

## 9.7 Backup / DR

- 日次フルバックアップ + ポイントインタイムリカバリ（PITR）対応のマネージドPostgreSQLを利用
- バックアップは暗号化し、本番環境とは別リージョン/アカウントに保管
- RPO（目標復旧時点）: 24時間以内、RTO（目標復旧時間）: Phase1では定義せずベストエフォート、Phase2以降でSLA化

## 9.8 AIへの送信データ制御

8章（AI Architecture）8.4節と対応。要点の再掲:

- 患者の氏名・住所等の直接識別情報は、Uchi OSのAI機能から到達不可能な別テーブル（`PatientIdentity`）に
  隔離されており、LLMへ送信されるデータパスに含まれることが構造上ない
- LLM呼び出しは共通のData Sanitizer関数を必ず経由し、送信ペイロードを `AIInsight.inputSummary` に記録して監査可能にする
- 職員名等もLLM出力においては匿名参照に置換する運用とする

## 9.9 インシデント対応（最低限）

- 不正アクセス検知（同一アカウントへの短時間大量ログイン失敗等）をAudit Logベースでアラート化（Phase2以降）
- インシデント発生時は影響組織を即座に特定できるよう、全ログに `organizationId` を必須付与
- データ漏洩が疑われる場合の初動手順（対象範囲特定→影響組織への通知→原因究明）をPhase2までに文書化
