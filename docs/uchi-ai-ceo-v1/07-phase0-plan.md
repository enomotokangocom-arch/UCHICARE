# Phase 0 実装タスク一覧

完成条件(仕様書14章): ユーザーがCSVをアップロード(またはサンプルデータ読込) →
システムがデータを解析 → ダッシュボードに 売上予測/利益予測/生産性/必要新規数/必要営業量/必要採用人数 を表示 →
異常があれば「今日判断すべきこと」カードを生成 → AIが状況/原因/推奨Action/期待効果/Confidenceを説明。

## タスク

1. **ドメイン型・config・モックデータ**
   `types.ts` / `config.ts`(閾値集約) / `mockData.ts`(3拠点・看護師約30名・利用者約300名・
   営業先100〜200件・12ヶ月分、以下の異常ケースを含む決定的生成)
   - 1拠点だけ売上低下
   - 終了利用者急増
   - 稼働率低下
   - 残業急増(生産性データのtravel/workにより間接表現)
   - 営業不足
   - 採用不足(90日後供給不足)

2. **CSV入出力**
   `csv.ts`: `monthly_branch_metrics.csv` / `nurse_productivity.csv` の2スキーマをパース。
   サンプルCSVをモックデータからダウンロード可能にし、アップロード→解析の動線を実際に検証できるようにする。

3. **Forecast Engine / Sales Engine / Productivity Engine**
   `04-forecast-engine.md` の数式をそのまま実装。単体で(UIなしに)テスト可能な純粋関数。

4. **Decision Engine**
   6種のDecisionルール + `rankDecisions()`(優先順位付け) + Explainability情報の付与。

5. **AI Agent連携**
   `/api/ceo/explain` + `explainClient.ts` + フォールバックテンプレート。

6. **Zustand Store + 監査ログ**
   データセット・Decision一覧・承認状態・監査ログをpersist。`StoreHydration.tsx` に追加。

7. **UI**
   `/ceo` ページ: 会社状態スコア / 主要KPI / 「今日CEOが判断すべきこと」(最大5件、カード) /
   「AIが処理済み」セクション / 拠点別テーブル / データソースパネル(CSV/モック切替) /
   Explainabilityモーダル。ナビゲーション(Sidebar・トップページ)に導線追加。

8. **ドキュメント・検証**
   README更新、`npm run lint`、`npm run build` によるビルド確認。

## Definition of Done

- [ ] モックデータ読込で6つの計算値がダッシュボードに表示される
- [ ] 用意したCSVサンプルを再アップロードしても同じ結果が再現される(決定的)
- [ ] 異常拠点(仙台東 想定)がRed severityのDecisionカードとして表示される
- [ ] Decisionカードから「詳細を見る」で使用データ・計算式・信頼度を確認できる
- [ ] ANTHROPIC_API_KEY未設定でもエラーにならず、テンプレート説明文が表示される
- [ ] `npm run lint` / `npm run build` が通る
