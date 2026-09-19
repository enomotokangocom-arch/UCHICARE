# UCHICARE

保健師・療法士・ケアマネジャーが監修する、企業向け健康経営データ可視化ツールのプロトタイプです。

労働環境(エルゴノミクス評価)・ミニストレスチェック・腰痛リスク調査・介護リスク調査(ビジネスケアラー)の4つの調査票をもとに、企業の健康経営指標をダッシュボードで可視化し、チャットで企業課題をキャッチアップします。

## 主な機能

- **健康経営ダッシュボード** (`/dashboard`): 総合スコア、4指標のレーダーチャート、部署別スコア、6ヶ月のトレンド推移、要注意ポイントの一覧を表示します。
- **調査票** (`/survey/*`): エルゴノミクス評価・ミニストレスチェック・腰痛リスク調査・介護リスク調査の4種類。回答すると自動でスコア化され、ダッシュボードに反映されます。
- **企業課題チャット** (`/chat`): ダッシュボードの集計データをもとに、Claude API (Claude Opus 5) が企業課題への質問にリアルタイムで回答します。
- **記事自動作成** (`/articles`): 自社HP向けのSEO記事をClaude APIで自動生成します。メインキーワード・サブキーワード・対象読者(地域の方・ケアマネジャー・医師)・記事カテゴリを指定すると、タイトル・メタディスクリプション・見出し構成・本文(Markdown)・想定検索キーワード・行動喚起(CTA)をまとめて生成します。
  - **SEOスコア判定**: タイトル・メタディスクリプションの長さやキーワード含有率、見出し数、本文の文字数などを機械的にチェックし、0〜100点のSEOスコアを算出します。スコアが90点未満の記事は承認できません。
  - **承認 → 自動送信キュー**: スコア90点以上の記事のみ「承認」でき、承認済み記事は公開待ちキューに入ります(承認日時が古い順)。キューの先頭から1日1件ずつ自動でWordPressに**下書き**として送信されます。バックエンドを持たないプロトタイプのため、アプリを開いたタイミングで「前回送信から1日以上経過したか」を判定して実行します(本番運用ではサーバー側の日次スケジューラでの実行を想定)。「今すぐWordPressへ送信する」で手動送信することも可能です。
  - **WordPress連携**: WordPress REST API (`/wp-json/wp/v2/posts`) を使い、常に **下書き(status=draft)** として投稿を作成します。実際にサイトへ公開するかどうかは、WordPress管理画面で人が最終確認したうえで判断する運用を想定しています(AIが生成した記事を人の確認なしに即座に公開サイトへ反映することはありません)。本文のMarkdownはHTMLに変換し、メタディスクリプションはWordPressの抜粋(excerpt)欄に設定します。

## データについて

このプロトタイプはバックエンドを持たず、ブラウザの `localStorage` にデータを保存します。初期状態では過去6ヶ月分のモックデータ(部署別・指標別)が投入されており、調査票に回答すると自身の回答が追加されてダッシュボードに反映されます。

## Getting Started

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いてください。

### 企業課題チャットを使う場合

`/chat` のAI応答にはClaude APIを使用します。`.env.local.example` を `.env.local` にコピーし、`ANTHROPIC_API_KEY` に [Anthropic Console](https://console.anthropic.com/) で発行したAPIキーを設定してください。

```bash
cp .env.local.example .env.local
# .env.local を編集して ANTHROPIC_API_KEY を設定
```

キーが未設定の場合、チャット画面はエラーメッセージを表示します(他の機能には影響しません)。

### 記事自動作成のWordPress連携を使う場合

`/articles` の記事生成にはClaude API(`ANTHROPIC_API_KEY`、上記と共通)を使用します。

承認済み記事をWordPressに下書き送信する機能を使うには、`.env.local` に以下を設定してください。

```bash
WORDPRESS_URL=https://example.com
WORDPRESS_USERNAME=wordpress-username
WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

`WORDPRESS_APP_PASSWORD` は通常のログインパスワードではなく、WordPress管理画面の
「ユーザー」→ 対象ユーザーの「プロフィール」画面下部にある「アプリケーションパスワード」から新規発行してください。
このユーザーには投稿を作成できる権限(投稿者以上)が必要です。

WordPress連携が未設定の場合、承認・自動送信キューの表示自体は使えますが、実際の送信(自動送信・「今すぐWordPressへ送信する」)はエラーになります。

## 技術スタック (健康経営ダッシュボード)

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Zustand (状態管理 / localStorage永続化)
- Recharts (グラフ描画)
- Claude API (`@anthropic-ai/sdk`) — 企業課題チャットのAI応答

---

# 採用CRM (Uchi care Recruitment CRM)

`/admin` 以下に、LINE公式アカウントを起点とした採用候補者管理(Talent Pool / Recruitment CRM)を実装しています。
単なる求人問い合わせ窓口ではなく、「今すぐ転職予定はないが将来的に候補者になりうる人」までLINE上でストックし、
属性取得 → 自動ナーチャリング → 行動データに基づくLead Score → 面談・見学・応募 → 採用、まで一気通貫で管理します。

## 機能一覧

- **LINE Webhook連携** (`/api/line/webhook`): 友だち追加・ブロック・メッセージ・Postbackを受信し、署名検証・冪等性(重複配信排除)を担保した上で候補者データベースに反映します。
- **オンボーディング**: 友だち追加時に職種(看護師/PT・OT・ST/ケアマネ/その他)→転職時期→希望エリアを、LINEのクイックリプライで負担なく取得します。
- **30日間ステップ配信**: Day0/1/3/7/10/14/21/30の自動配信。職種によって内容を出し分けます(`prisma/seed.ts` で初期シーケンスを投入)。
- **継続ナーチャリング / 再ヒアリング**: 30日終了後も定期配信の土台(StepSequence)を用意。転職意向「情報収集中」「半年〜1年以内」の候補者には90日・180日ごとに意向を再確認し、過去の回答は上書きせず履歴(CandidateEvent)として保持します。
- **Lead Score / Lead Status**: 行動(求人閲覧・LINE返信・見学希望・応募など)に応じたスコア加算と、Cold/Warm/Hotへの自動昇格。閾値・配点は管理画面(`/admin/lead-score`)から変更可能です。
- **候補者CRM**: 一覧(`/admin/candidates`、職種・転職時期・エリア・Lead Status・ステージ・タグ・担当者・期間でのフィルタ+フリーワード検索)、詳細(`/admin/candidates/[id]`、プロフィール・タグ・タイムライン)、選考カンバン(`/admin/kanban`、ドラッグ&ドロップでステージ変更)。
- **Talent Pool** (`/admin/talent-pool`): 職種別の保有候補者数・温度別内訳・転職時期別内訳を可視化。
- **採用ダッシュボード** (`/admin/dashboard`): LINE友だち数・新規登録・ブロック率・職種/転職時期取得率・各CVR・ファネルなどをKPIカードとグラフで表示(期間フィルタ対応)。
- **Today's Action** (`/admin` トップ): HOT候補者・未対応のLINE質問・面談/見学希望・7日以上未対応・再ヒアリング対象を一覧化し、今日やるべき対応が一目でわかる業務画面にしています。
- **配信管理 / AIコンテンツ生成** (`/admin/campaigns`): DRAFT→REVIEW→APPROVED→SCHEDULED→SENTの承認ワークフロー。Claude APIによる配信案生成(3案)にも対応していますが、**生成された文章がそのまま自動配信されることはなく**、必ず人間の確認・編集・承認を経てから予約配信されます。
- **マスタ管理** (`/admin/masters`): 職種・エリア・タグ・流入経路を管理画面から追加/編集できます(コード管理せず拡張可能)。
- **リッチメニュー設定** (`/admin/rich-menu`): 6メニューのリンク先を管理画面から変更可能(画像のアップロード自体はLINE Developersコンソール側の作業を想定)。
- **スタッフ管理・RBAC** (`/admin/users`): ADMIN / RECRUITER / VIEWER の3ロール。VIEWERは閲覧のみ、RECRUITERは候補者操作可、ADMINはマスタ・承認・配信・スタッフ管理まで可能です。
- **通知** (`/admin/notifications`): カジュアル面談・見学希望・LINE質問・HOT化・長期未対応・再ヒアリング対象の発生を通知として記録。Slack Webhook等への配信は`NotificationProvider`抽象化により後から追加できます。
- **監査ログ**: 候補者情報の変更・スタッフ操作・キャンペーン承認等を`AuditLog`に記録します。

## セットアップ

```bash
cp .env.local.example .env.local
# .env.local を編集: DATABASE_URL, AUTH_SECRET, SEED_ADMIN_EMAIL/PASSWORD, LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, CRON_SECRET 等

npm install
npm run db:migrate   # Prismaマイグレーション適用 (開発時はSQLiteファイルを作成)
npm run db:seed      # マスタデータ・初期ステップ配信・スタッフアカウント・デモ候補者を投入
npm run dev
```

[http://localhost:3000/admin/login](http://localhost:3000/admin/login) から、シードで作成した管理者アカウント(`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`)でログインできます。

### 環境変数

| 変数 | 用途 |
| --- | --- |
| `DATABASE_URL` | Prisma接続文字列。開発時は `file:./dev.db` (SQLite)。本番はPostgreSQL等への切り替えを推奨(`prisma/schema.prisma` の `datasource.provider` を変更)。 |
| `AUTH_SECRET` | 管理画面セッション(JWT)の署名鍵。32文字以上のランダムな文字列を設定してください。 |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `npm run db:seed` で作成される初回管理者アカウント。 |
| `LINE_CHANNEL_SECRET` | LINE Webhookの署名検証に使用(必須)。 |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINEへのメッセージ送信(Push/Reply/Multicast)に使用。 |
| `CRON_SECRET` | 定期実行ジョブ(ステップ配信・再ヒアリング・キャンペーン配信)を保護するBearerトークン。 |
| `SLACK_WEBHOOK_URL` | (任意) 通知をSlackにも送信する場合に設定。 |

### LINE Developersコンソール側の設定

1. Messaging APIチャネルを作成し、Webhook URLに `https://<your-domain>/api/line/webhook` を設定してWebhookを有効化してください。
2. Channel Secret / Channel Access Token を `.env.local` (本番はホスティング先の環境変数) に設定してください。
3. リッチメニューの画像自体はLINE Developersコンソールまたは Messaging API での画像アップロードが必要です(本アプリではリンク先の管理のみ行います)。

### 定期実行ジョブ (Cron)

以下のエンドポイントを、Vercel Cron等から `Authorization: Bearer <CRON_SECRET>` 付きで定期的に呼び出してください。

| エンドポイント | 推奨頻度 | 内容 |
| --- | --- | --- |
| `POST /api/cron/step-sequences` | 1日1回以上 | 30日間ステップ配信の進行(Day1〜30の未送信メッセージを配信) |
| `POST /api/cron/rehearing` | 1日1回 | 90日/180日の転職意向再ヒアリング送信 |
| `POST /api/cron/stale-check` | 1日1回 | 長期未対応候補者の通知生成 |
| `POST /api/cron/campaigns` | 数分〜1時間に1回 | 予約配信(SCHEDULED)キャンペーンの配信実行 |

## セキュリティ

- パスワードは bcrypt でハッシュ化して保存し、平文では保持しません。
- 管理画面セッションは HttpOnly / SameSite=Lax Cookie + JWT (`AUTH_SECRET`)で管理し、`src/proxy.ts` (旧middleware) でUIレベルの未認証アクセスを防止した上で、各APIルートでも `requireSession()` により認証・ロール(RBAC)を再検証しています。
- LINE Webhookは署名検証(HMAC-SHA256)を必須とし、`webhookEventId` によりWebhookの重複配信に対して冪等性を担保しています。
- 個人情報(氏名・電話番号・メール等)を含む候補者データの変更操作は `AuditLog` に記録されます。候補者の削除は物理削除ではなく論理削除(`deletedAt`)です。
- 入力値は zod でバリデーションし、Prisma(パラメータ化クエリ)によりSQLインジェクションを防止しています。
- ログイン・LINE Webhookエンドポイントにはインメモリのレートリミットを適用しています(複数インスタンスでスケールする場合はRedis等への置き換えを推奨)。
- LINE User ID等の個人情報はログに出力しない実装にしています。

## データベース設計

`prisma/schema.prisma` を参照してください。Candidate(候補者)を中心に、CandidateProfile相当の拡張情報・タグ・イベント(タイムライン)・LINEメッセージ/インタラクション・ステップ配信・キャンペーン・面談/見学/応募・通知・監査ログを正規化したテーブルで管理しています。
