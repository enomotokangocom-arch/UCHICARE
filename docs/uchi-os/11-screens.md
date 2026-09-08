# 11. 画面一覧

全画面レスポンシブ対応。特に CEO Morning はモバイル最優先（3.7章・12章）。

| # | 画面 | パス | 主な利用者 | 目的・主要コンポーネント | Phase |
|---|---|---|---|---|---|
| 1 | Login | `/uchi-os/login` | 全員 | メール+パスワード認証、組織選択（複数組織所属時） | 1 |
| 2 | CEO Morning | `/uchi-os` (ログイン後デフォルト) | 経営者 | Health Scoreサマリー、TODAY Top5カード、承認/修正/保留CTA | 1(簡易)/2(本実装) |
| 3 | Company Dashboard | `/uchi-os/dashboard/company` | 経営者 | 全社KPI、拠点別比較、トレンドグラフ | 1 |
| 4 | Station Dashboard | `/uchi-os/dashboard/station/[stationId]` | 拠点管理者/経営者 | 拠点別の売上・利用者・訪問・稼働率 | 1 |
| 5 | Financial Dashboard | `/uchi-os/dashboard/financial` | 経営者/経理 | 人件費率・営業利益率・EBITDA・Cash Runway | 1 |
| 6 | Sales Dashboard | `/uchi-os/dashboard/sales` | 営業責任者/経営者 | 紹介元別売上、営業ROI、最終訪問日一覧 | 1 |
| 7 | Workforce Dashboard | `/uchi-os/dashboard/workforce` | 人事/経営者 | FTE、離職率、採用状況、稼働率分布 | 1 |
| 8 | Alerts | `/uchi-os/alerts` | 全ロール（スコープに応じ絞り込み） | Alert一覧、フィルタ（severity/status/station） | 2 |
| 9 | AI Decisions | `/uchi-os/decisions` | 経営者 | Decision一覧・詳細（原因分解、Confidence、根拠KPI） | 2 |
| 10 | Action Center | `/uchi-os/actions` | 全ロール | 自分がOwnerのAction、状態遷移管理、実績記録 | 2 |
| 11 | AI経営参謀Chat | `/uchi-os/chat` | 経営者中心 | 自然言語チャット、結論→根拠→数値→リスク→推奨Action形式 | 3 |
| 12 | Scenario Simulator | `/uchi-os/scenarios` | 経営者 | What-ifシナリオ作成・結果表示 | 3 |
| 13 | Data Import | `/uchi-os/import` | 経理/管理者 | CSV/Excelアップロード、手入力フォーム、取込エラー確認 | 1 |
| 14 | Settings | `/uchi-os/settings` | Owner/Admin | 拠点管理、ユーザー管理、閾値設定、AI送信データポリシー確認 | 1(最小)/2(本実装) |

## モバイル対応方針

- CEO Morning・Alerts・Action Center は 375px幅を基準にカードUIで縦積み表示（12章）
- Dashboard系（Company/Station/Financial/Sales/Workforce）はモバイルでもグラフを縦に折り返して閲覧可能にする。ただし主要な操作導線はデスクトップ/タブレット優先
- Scenario Simulator・Data Import はデスクトップ優先だが、閲覧のみはモバイルでも可能にする
