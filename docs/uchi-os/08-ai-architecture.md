# 8. AI Architecture

## 8.1 基本原則

> LLMにすべて計算させない。売上・人件費率・EBITDA等の重要数値はコード側で計算する。

LLM（Claude API）の役割は**解釈・説明・言語化**に限定し、**演算・集計・判定**は行わせない。
04章のレイヤードアーキテクチャにおけるLLM Reasoning Layerは、Decision Engineが生成した
「構造化データ（数値・要因・Confidence）」を入力として受け取り、自然文を出力するだけの層。

## 8.2 LLMの用途（4つに限定）

| 用途 | 入力 | 出力 | 数値の扱い |
|---|---|---|---|
| 原因説明 | Decision.rootCause（JSON） | 自然文の説明（例:「売上低下の約67%は利用終了による訪問件数減少と推定されます」） | 割合・金額はコードが計算した値をプロンプトに埋め込み、LLMはそれを文章化するのみ。LLMが新たな数値を生成することは禁止（プロンプトで明示的に指示） |
| 仮説生成 | 複数KPIの相関・トレンド | 「〜という可能性があります」形式の仮説（複数提示可） | 仮説は必ず AI ESTIMATE として表示。断定的な言い切りを避ける文体をシステムプロンプトで強制 |
| Action候補生成 | Decision + 過去の類似Decisionに対するAction実績（Phase4） | Action候補の文言・Owner候補・Deadline目安 | 期待効果の数値レンジはCalculation Engine側で算出したレンジをそのまま使用 |
| 自然言語回答（チャット） | ユーザー質問 + KPI Engine/Decision Engineから取得した関連データ | 12章のフォーマット（結論→根拠→数値→リスク→推奨Action）に従った回答 | 数値は必ずKPI Engineから取得した値を引用。LLMが独自に算出しない |

## 8.3 プロンプト設計原則

1. **System Prompt** で常に以下を強制する:
   - 「あなたは数値を計算しない。渡された数値のみを使う」
   - 「事実(FACT)・計算値(CALCULATED)・推定(AI ESTIMATE)を区別して回答する」
   - 「データが不足している場合は断定せず、必要なデータを明示する」
   - 「出力は日本語、結論→根拠→数値→リスク→推奨Actionの順」
2. **Few-shot例**を各Decision RuleごとにPhase3で整備し、文体・粒度を統一
3. **構造化出力**（JSON mode等）でAction候補生成を行い、後段のAction Engineが機械的にパースできるようにする
4. **入力データの最小化**: プロンプトには「その回答に必要な最小限のKPI・要因データ」のみを渡す
   （09章のデータ最小化原則、患者個人を特定できる情報は一切渡さない）

## 8.4 データ最小化とAIへの送信データ制御

LLMへ送信するプロンプトは、Decision Engine/KPI Engineが生成した**集計済み・匿名化済みの構造化データ**
のみとする。以下を送信データ生成レイヤー（Data Sanitizer）で機械的に保証する。

| 禁止データ | 理由 | 代替 |
|---|---|---|
| `PatientIdentity`（氏名・住所） | 直接識別情報 | 送信対象外（そもそも別テーブルでAIコンポーネントからアクセス不可） |
| `Patient.pseudoId` の生値を大量に列挙 | 個人の行動パターンが推定できる | 集計値（件数・比率）のみ送信。個票を送る必要がある場合も `pseudoId` はマスクした集約IDに変換 |
| `Employee.name` | 個人特定 | 原因説明では「職員」「特定の職員」等の匿名参照に置換。Action Ownerの指定はUI側でIDから氏名を解決し、LLM出力には含めない設計 |
| `PatientEvent.note` の自由記述 | PII混入リスク | Phase1-3では原則プロンプトに含めない。将来含める場合は事前にPIIスクラビング処理を必須化 |

Data Sanitizerは、LLM呼び出し直前の共通関数として実装し、**バイパス不可**（Decision Engine/Chat機能は
必ずこの関数を経由してLLM APIを呼ぶ）。送信直前のペイロードは `AIInsight.inputSummary` として保存し、
監査可能にする（09章 Audit Log と連携）。

## 8.5 Confidence とAI ESTIMATEの取り扱い

- Confidence（07章の共通式）が閾値（default: 0.5）未満の場合、LLMには「Confidenceが低いため、
  断定的な結論ではなく複数の可能性として提示すること」という指示を追加する
- チャット回答でデータが不足する質問（例: 未登録のKPIに関する質問）には、LLMに数値を創作させず
  「判断に必要なデータ: 〜」という定型フォーマットで返す（12章）

## 8.6 モデル・API運用

- 使用モデル: Claude API（本リポジトリは既に `@anthropic-ai/sdk` を利用中。Phase3で `AIInsight.model` に
  実際に使用したモデルIDを記録し、後から追跡可能にする）
- タイムアウト/エラー処理: LLM呼び出しが失敗してもDecision/Alert自体はCalculation〜Rule Engineの結果で
  表示可能（4.4章の非機能要件、単一障害点にしない）
- レート制御: 日次バッチでの一括生成（Decision数 × 1回程度）とチャットのオンデマンド呼び出しを分離し、
  バッチはキュー経由でレート制限を回避

## 8.7 将来のMulti-Agent化（設計のみ、MVP非実装）

24章の通り、将来的に以下の専門Agentへ発展させる構想を持つが、**MVP段階では単一のLLM Reasoning Layer
（単一プロンプト・単一エージェント）に留め、監査可能でシンプルな構造を優先する**。

| 将来Agent | 責務（構想） |
|---|---|
| AI CFO | 財務系Decision Rule（DR-08, 09, 17, 18, 19, 20）の深掘り分析・資金計画提案 |
| AI COO | オペレーション系（DR-06, 07, 13, 14）の人員配置最適化 |
| AI CHRO | 採用・離職系（DR-15, 16）の採用戦略立案 |
| AI Sales Director | 営業系（DR-10, 11, 12）の営業戦略立案 |

拡張時も「LLMは計算しない」「Human Approvalを経る」というアーキテクチャ原則は維持する。
Multi-Agent化する場合も、各Agentは同一のCalculation/KPI/Rule Engineの出力を共有の事実源として参照し、
Agent間で数値の不整合が起きない設計とする（Orchestratorが各Agentの出力を統合してAction Engineへ渡す）。
