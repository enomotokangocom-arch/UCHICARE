# 14. Repository Structure

既存のUCHICARE（健康経営ダッシュボード）と同一リポジトリ内に、名前空間を分離して追加する
（00-README.md の前提）。単一Next.jsアプリ構成を維持し、Phase1-3の規模ではモノレポ分割は行わない
（過剰な抽象化を避ける、AGENTS.mdの精神にも合致）。

```
UCHICARE/
├── docs/
│   └── uchi-os/                     # 本設計ドキュメント一式
├── prisma/
│   └── schema.prisma                # Uchi OS用スキーマ（05章）。既存UCHICAREはDB非使用のため新規追加
├── src/
│   ├── app/
│   │   ├── (existing UCHICARE routes: dashboard, survey, chat, articles ...) # 変更しない
│   │   └── uchi-os/                 # Uchi OS 画面（11章の14画面）
│   │       ├── page.tsx             # CEO Morning（デフォルト）
│   │       ├── login/
│   │       ├── dashboard/
│   │       │   ├── company/
│   │       │   ├── station/[stationId]/
│   │       │   ├── financial/
│   │       │   ├── sales/
│   │       │   └── workforce/
│   │       ├── alerts/
│   │       ├── decisions/
│   │       ├── actions/
│   │       ├── chat/
│   │       ├── scenarios/
│   │       ├── import/
│   │       └── settings/
│   │
│   ├── app/api/uchi-os/             # 10章のAPI設計に対応するRoute Handlers
│   │   ├── auth/…
│   │   ├── ceo-morning/route.ts
│   │   ├── kpi/route.ts
│   │   ├── dashboard/…
│   │   ├── alerts/…
│   │   ├── decisions/…
│   │   ├── actions/…
│   │   ├── chat/route.ts
│   │   ├── scenarios/route.ts
│   │   ├── import/…
│   │   └── internal/jobs/…          # Cron専用（10.9節）
│   │
│   ├── components/uchi-os/          # Uchi OS専用コンポーネント（既存UCHICAREのcomponentsとは分離）
│   │   ├── ceo-morning/
│   │   │   ├── HealthScoreCard.tsx
│   │   │   ├── TodayDecisionCard.tsx
│   │   │   └── DataSourceBadge.tsx  # FACT/CALCULATED/AI ESTIMATEバッジ（12.5節）
│   │   ├── dashboard/
│   │   └── shared/
│   │
│   └── server/uchi-os/              # ドメインロジック（04章のレイヤー構成を忠実に反映）
│       ├── calculation-engine/      # 純粋関数。売上/人件費率/EBITDA/Cash Runway等（06章の式）
│       ├── kpi-engine/              # Calculation Engineの出力をKPISnapshotへ正規化
│       ├── rule-engine/             # 20 Decision Rules（07章）の評価ロジック
│       │   └── rules/
│       │       ├── dr-01-revenue-decline.ts
│       │       ├── ...
│       │       └── dr-20-withdrawal.ts
│       ├── forecast-engine/         # 決定論的予測（回帰・移動平均）
│       ├── decision-engine/         # Alert+Forecast→Decision生成、Confidence計算（07章共通式）
│       ├── action-engine/           # Action状態遷移、Human Approval強制ロジック
│       ├── ai/                      # LLM Reasoning Layer（8章）
│       │   ├── sanitizer.ts         # Data Sanitizer（PII除去、8.4節でバイパス不可の共通関数）
│       │   ├── prompts/             # ルール別・用途別プロンプトテンプレート
│       │   └── client.ts            # Claude API呼び出しの唯一の入口
│       ├── import/                  # CSV/Excelパーサ・バリデーション・Adapter Layer（14章）
│       ├── auth/                    # RBAC・テナントコンテキスト解決（09章）
│       └── db/
│           └── client.ts            # Prisma Client + RLSセッション変数設定
│
├── scripts/
│   └── uchi-os/
│       └── seed-sample-org.ts       # 3拠点サンプル法人 + 12ヶ月ダミーデータ生成（15章）
│
└── docs/uchi-os/…（本ドキュメント群）
```

## 設計上の要点

- `src/server/uchi-os/` 配下は **DBアクセスとLLMアクセスを持つレイヤーを明示的に分離**しており、
  `calculation-engine` / `kpi-engine` / `rule-engine` / `forecast-engine` は純粋関数のみで構成し、
  ユニットテストをDB接続なしで実行できるようにする
- `ai/` 配下以外から Anthropic SDK を直接importしない（8.4節・13.7節の原則をディレクトリ構造でも強制、
  lintの `no-restricted-imports` ルールで担保する想定）
- 既存UCHICAREのコード（`src/app/dashboard`, `src/lib/*` 等）は変更せず共存させる。共通化できそうな
  UIプリミティブ（ボタン等）が出てきた場合も、Phase1では無理に共通化せず重複を許容し、Phase2以降で
  必要性が明確になってから `src/components/shared/` への切り出しを検討する
