# Decision Engine 設計

## ルールフォーマット

全Decisionは以下の統一フォーマットで定義する(仕様書4章)。

```
IF [状態]
AND [条件]
THEN [Action]
BECAUSE [根拠]
EXPECT [期待結果]
ESCALATE IF [例外条件]
```

`src/lib/ceo/decisionEngine.ts` では、各ルールを次の純粋関数シグネチャで実装する。

```ts
type DecisionRule<TInput> = (input: TInput, config: ThresholdConfig) => Decision | null;
```

ルールは副作用を持たず、`(集計済みデータ, 閾値設定) → Decision | null` の決定的関数とする。
LLMはこの後段で `reasoningSummary` / `recommendedAction` / `expectedImpact` の文章を
自然文化するためだけに呼ばれ、`currentValue` / `gap` / `severity` / `confidenceScore` はLLMを介さず算出する。

## 20意思決定 一覧とPhase 0 対応

| # | 意思決定 | decision_type | Phase 0 | 主計算 |
|---|---|---|---|---|
| 1 | 月末売上予測 | `revenue_forecast` | ✅実装 | `forecastEngine.ts` |
| 2 | 月末利益予測 | `profit_forecast` | ✅実装 | `forecastEngine.ts` |
| 3 | 拠点別PL | `branch_pl` | 型のみ(拡張ポイント) | — |
| 4 | KPI異常検知 | `kpi_anomaly` | 型のみ | — |
| 5 | 今日の経営優先順位 | `priority_ranking` | ✅簡易実装(Decision一覧のソートとして統合) | `decisionEngine.ts` |
| 6 | 看護師別訪問生産性 | `nurse_productivity` | ✅実装 | `productivityEngine.ts` |
| 7 | 拠点別稼働率 | `branch_utilization` | ✅実装(KPI表示のみ、Decision化はPhase1) | `productivityEngine.ts` |
| 8 | 空き訪問枠 | `available_capacity` | 型のみ | — |
| 9 | 供給不足予測 | `capacity_gap_forecast` | ✅簡易実装(必要採用人数の内部計算として利用) | `salesEngine.ts` |
| 10 | 必要採用人数 | `required_hiring` | ✅実装 | `salesEngine.ts` |
| 11 | 新規利用者数 | `new_patients_tracking` | 型のみ | — |
| 12 | 終了利用者分析 | `discharge_analysis` | 型のみ | — |
| 13 | 入院分析 | `hospitalization_analysis` | 型のみ | — |
| 14 | 30/90日利用者予測 | `patient_forecast` | ✅簡易実装(必要採用人数計算の内部予測として利用) | `salesEngine.ts` |
| 15 | 必要新規利用者数 | `required_new_patients` | ✅実装 | `salesEngine.ts` |
| 16 | 必要営業量 | `required_sales_activity` | ✅実装 | `salesEngine.ts` |
| 17 | 営業先別紹介率 | `referral_source_stats` | 型のみ | — |
| 18 | 営業先優先順位 | `referral_source_ranking` | 型のみ | — |
| 19 | 残業・業務負荷異常 | `workload_risk` | 型のみ | — |
| 20 | 採用開始タイミング | `recruitment_timing` | ✅実装(必要採用人数Decisionに開始推奨日を含める) | `salesEngine.ts` |

実装上の注記: #15(必要新規利用者数)と#16(必要営業量)は計算パイプラインが直結しているため、
Phase 0ではUIの重複を避けて1つの `required_sales_activity` Decisionカードにまとめて表示する
(内部的には両方の値を算出・保持している)。#9(供給不足予測)と#20(採用開始タイミング)も同様に
`required_hiring` Decisionカードに統合する。

「型のみ」の項目は `decisionType` の union と `entityType` を `types.ts` に予約済みで、Phase 1で
ルール関数を追加するだけで Decision Engine / Dashboard に自動的に載る設計になっている
(`DecisionCard` 等のUIは `decisionType` に依存しない汎用コンポーネント)。

## Phase 0 実装ルール詳細

### 1. 月末売上予測 (`revenue_forecast`)

```
IF   ForecastRevenue < RevenueBudget × (1 - 0.03)
AND  ForecastRevenue >= RevenueBudget × (1 - 0.05)
THEN severity = yellow
IF   ForecastRevenue < RevenueBudget × (1 - 0.05)
THEN severity = red
BECAUSE 売上Gapを新規/終了/入院/キャンセル/加算などの金額要因に分解して提示
EXPECT  提示した改善アクションにより Gap の一部を回収
ESCALATE IF severity = red かつ2ヶ月連続
```

### 2. 月末利益予測 (`profit_forecast`)

```
IF   ForecastProfit < ProfitBudget
THEN Gapを 売上不足/残業増加/採用費/その他固定費 に分解
BECAUSE 計画利益との差分要因
EXPECT 是正アクションにより利益Gapを縮小
```

### 6. 看護師別訪問生産性 (`nurse_productivity`)

単純な訪問件数のみでの評価を禁止し、Clinical Utilization / Revenue Productivity /
Visit Productivity / Travel Efficiency の4指標を合成して低生産性者を検知する。

```
IF   ClinicalUtilization < threshold.lowUtilization
OR   TravelEfficiency < threshold.lowTravelEfficiency
THEN severity = yellow (該当職員をリストアップ、個人攻撃ではなくシフト/エリア設計の課題として提示)
```

### 10/15/16/20. 必要新規利用者数・必要営業量・必要採用人数・採用開始タイミング

これらは連鎖するため1つのDecision生成パイプラインとして実装する
(`RevenueGap → RequiredNewPatients → RequiredSalesActivity`、
`CapacityGap → RequiredFTE → RecruitmentStartDate`)。

```
RequiredNewPatients   = max(0, RevenueGap) / AvgMonthlyRevenuePerPatient
RequiredReferrals     = RequiredNewPatients / ReferralToContractCVR
RequiredSalesActivity = RequiredReferrals / SalesToReferralCVR

CapacityGapHours(90d) = FutureRequiredVisitHours(90d) - FutureAvailableStaffHours(90d)
RequiredFTE           = max(0, CapacityGapHours) / AvgProductiveHoursPerFTE
RecruitmentStartDate  = ProjectedShortageDate - AverageHiringLeadTimeDays
```

## 優先順位付け(項目5: 今日の経営優先順位)

```
PriorityScore = FinancialImpact × Urgency × Probability × Irreversibility
```

`decisionEngine.ts` の `rankDecisions()` が全Decisionにこのスコアを付与し、上位3〜5件を
「今日CEOが判断すべきこと」として抽出する。各係数の算出方法:

- `FinancialImpact`: `abs(gap) / 基準額`(0〜1に正規化)
- `Urgency`: 残日数が短いほど高い(月末売上は残日数、採用は採用開始推奨日までの日数)
- `Probability`: Decisionの `probability`(統計的な発生確率 or 予測の確信度)
- `Irreversibility`: `decisionType` ごとに設定した固定係数(採用・営業戦略変更は高め、KPI通知は低め)

## Explainability

各Decisionは `explain.dataUsed` / `explain.formula` / `explain.mainFactors` / `explain.alternatives` を
必ず保持し、`ExplainModal` でブラックボックス化せず表示する(11章要件)。
