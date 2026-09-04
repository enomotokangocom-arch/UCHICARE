# AI Agent 設計

## 役割の限定

LLM(Claude)は以下の**文章生成のみ**に用いる。数値計算・集計・予測には使わない(仕様書5章)。

- Decisionの状況・原因の要約(`reasoningSummary`)
- 推奨Actionの文章化(`recommendedAction` の自然文表現)
- 期待効果の説明文(`expectedImpact`)
- 自然言語UI(将来の `/ceo/chat` 拡張ポイント。Phase 0では未実装)

## Provider Abstraction

```ts
// src/lib/ceo/aiProvider.ts
interface AiNarrativeProvider {
  explainDecisions(input: DecisionNarrativeInput[]): Promise<DecisionNarrativeOutput[]>;
}
```

Phase 0では `AnthropicNarrativeProvider` のみを実装し、`@anthropic-ai/sdk` への依存を
この1ファイルに閉じ込める。OpenAI/Gemini等への切替はこのインターフェースを実装するクラスを
追加するだけで良い設計とする(将来の実装リスク低減)。

## 送信データの最小化(12章 セキュリティ準拠)

LLMには **集計値・比率のみ** を送信し、患者個人情報・職員個人情報は送信しない。

```ts
interface DecisionNarrativeInput {
  decisionType: DecisionType;
  entityLabel: string;         // "仙台東" のような拠点名(個人名は含めない)
  currentValue: number;
  targetValue: number;
  gap: number;
  severity: "green" | "yellow" | "red";
  mainFactors: { label: string; contribution: number }[]; // 金額/件数の要因内訳(匿名化済み)
  confidenceScore: number;
}
```

## API

`POST /api/ceo/explain`

- Request: `{ decisions: DecisionNarrativeInput[] }`(最大5件/リクエスト)
- Response: `{ narratives: DecisionNarrativeOutput[] }`
- `ANTHROPIC_API_KEY` 未設定時は 500 を返し、クライアント側 (`explainClient.ts`) が
  決定的なテンプレート文(`buildFallbackNarrative()`)へ自動フォールバックする。
  これにより **APIキーがなくてもダッシュボードの主要機能(数値・Decision生成)は完全に動作する**
  (既存 `/chat` `/articles` と同じ設計方針)。

## プロンプト設計方針

- system prompt: 「Uchi careの経営アドバイザーとして、与えられた集計値のみを根拠に、事実に基づいた
  簡潔な説明文を生成する。数値の創作・誇張をしない。個人を特定しない」を明記
- 出力は必ずJSON( `{ decisionId, reasoningSummary, recommendedAction, expectedImpact }[]` )のみとし、
  既存 `articleGenerator.ts` の `parseGeneratedArticle` と同様のコードブロック除去・JSONパースを行う
- `model: "claude-sonnet-5"`, `output_config: { effort: "low" }` を採用(低レイテンシ優先、既存 `/chat` 準拠)

## Explainability との関係

`reasoningSummary` 等のLLM生成文はあくまで「文章表現」であり、`currentValue` / `gap` / `mainFactors` 等の
根拠データは全てEngine側で計算済みの値をそのまま表示する。UIの `ExplainModal` は
LLM生成文とは別に、計算に使った生データ・数式を必ず併記し、AIの説明とシステムの根拠を分離して
検証可能にする(ブラックボックス化しない)。
