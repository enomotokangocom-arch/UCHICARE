# 6. KPI Definition Table

全KPIは `KPISnapshot.kpiCode` として保存される。`type` 列は 22章の FACT / CALCULATED / AI_ESTIMATE
区分に対応する（本章のKPIはすべてFACTまたはCALCULATEDであり、AI_ESTIMATEはForecast Engine由来の
値のみに使う。08章参照）。

## 6.1 売上系

| kpiCode | 名称 | 式 | type | 粒度 |
|---|---|---|---|---|
| `monthly_revenue` | 月間売上 | `FinancialRecord.revenue` の合計 | FACT | 拠点/全社×月 |
| `revenue_by_station` | 拠点別売上 | 拠点ごとの `monthly_revenue` | FACT | 拠点×月 |
| `revenue_mom` | 前月比 | `(当月revenue - 前月revenue) / 前月revenue × 100` | CALCULATED | 拠点/全社×月 |
| `revenue_yoy` | 前年同月比 | `(当月revenue - 前年同月revenue) / 前年同月revenue × 100` | CALCULATED | 拠点/全社×月 |
| `revenue_per_nurse` | 看護師1人当たり売上 | `monthly_revenue ÷ 看護師FTE合計` | CALCULATED | 拠点/全社×月 |
| `revenue_forecast_*` | 売上予測（当月末/翌月/3ヶ月後） | Forecast Engine（10章参照） | AI_ESTIMATE* | 拠点/全社 |

\* 予測は「AIによる推測」ではなく数式（回帰・移動平均）によるが、未確定の将来値であるためUI上は
`AI_ESTIMATE`（またはこれに準ずる「予測」バッジ）として表示し、確定値のFACT/CALCULATEDと区別する。
09-ai-architecture.mdの「AIによる推測と計算の分離」原則に従い、予測の生成ロジック自体は決定論的な
数式（LLM不使用）であることを明記する。

## 6.2 利用者系

| kpiCode | 名称 | 式 | type |
|---|---|---|---|
| `patient_count` | 利用者数（期末時点の稼働中利用者） | `Patient` のうち `endedAt IS NULL` の件数 | FACT |
| `new_patients` | 新規利用者 | 当月 `startedAt` を持つ `Patient` 件数 | FACT |
| `ended_patients` | 終了利用者 | 当月 `endedAt` を持つ `Patient` 件数 | FACT |
| `net_patient_change` | 純増数 | `new_patients − ended_patients` | CALCULATED |
| `new_to_start_rate` | 新規→利用開始率 | `当月中に実際にVisitが発生した新規Patient数 ÷ new_patients × 100` | CALCULATED |
| `avg_care_duration_days` | 平均利用期間 | 当月終了した `Patient` の `endedAt - startedAt` の平均（日数） | CALCULATED |

## 6.3 訪問系

| kpiCode | 名称 | 式 | type |
|---|---|---|---|
| `total_visits` | 総訪問件数 | 当月 `Visit` 件数 | FACT |
| `total_visit_minutes` | 総訪問時間 | 当月 `Visit.durationMinutes` の合計 | FACT |
| `visit_minutes_by_employee` | 職員別訪問時間 | 職員ごとの `total_visit_minutes` | FACT |
| `visit_minutes_per_nurse` | 看護師1人当たり訪問時間 | `total_visit_minutes ÷ 看護師FTE合計` | CALCULATED |
| `utilization_rate` | 稼働率 | `実訪問時間 ÷ 標準稼働可能時間（FTE×契約労働時間×稼働日数） × 100` | CALCULATED |

## 6.4 人員系

| kpiCode | 名称 | 式 | type |
|---|---|---|---|
| `nurse_count` | 看護師数 | `Employee` (`employeeType=NURSE`, 在籍中) の人数 | FACT |
| `therapist_count` | リハ職数 | 同上 `THERAPIST` | FACT |
| `office_staff_count` | 事務職数 | 同上 `OFFICE` | FACT |
| `total_fte` | FTE | 在籍中 `Employee.fte` の合計 | CALCULATED |
| `hires_count` | 採用数 | 当月 `hiredAt` を持つ `Employee` 件数 | FACT |
| `resignations_count` | 退職数 | 当月 `resignedAt` を持つ `Employee` 件数 | FACT |
| `turnover_rate` | 離職率 | `当月resignations_count ÷ 月初在籍数 × 100`（年率換算値も別途算出） | CALCULATED |

## 6.5 財務系

| kpiCode | 名称 | 式 | type |
|---|---|---|---|
| `revenue` | 売上 | `FinancialRecord.revenue` | FACT |
| `labor_cost` | 人件費 | `FinancialRecord.laborCost` | FACT |
| `labor_cost_ratio` | 人件費率 | `labor_cost ÷ revenue × 100` | CALCULATED |
| `operating_profit` | 営業利益 | `revenue − labor_cost − otherFixedCost − otherVariableCost` | CALCULATED |
| `operating_profit_margin` | 営業利益率 | `operating_profit ÷ revenue × 100` | CALCULATED |
| `ebitda` | EBITDA | `operating_profit + 減価償却費`（減価償却費は将来 `otherFixedCost` の内訳として拡張、MVPでは0扱い可） | CALCULATED |
| `cash_balance` | 現預金 | `FinancialRecord.cashBalance`（法人全体） | FACT |
| `monthly_net_burn` | 月次Burn Rate | `max(0, 当月支出合計 − 当月収入合計)`（黒字月は0） | CALCULATED |
| `cash_runway_months` | Cash Runway | `cash_balance ÷ 直近3ヶ月平均 monthly_net_burn`（Burnが0またはマイナスなら「Runway上問題なし」を意味する特別値として扱う） | CALCULATED |

## 6.6 営業系

| kpiCode | 名称 | 式 | type |
|---|---|---|---|
| `sales_activity_count` | 営業件数 | 当月 `SalesActivity` 件数 | FACT |
| `active_referral_sources` | 営業先数 | 当月営業活動のあった `ReferralSource` のユニーク数 | FACT |
| `referral_count` | 紹介件数 | 当月 `SalesActivity.resultedInReferral=true` の `referredPatientCount` 合計 | FACT |
| `referral_rate` | 紹介率 | `referral_count ÷ sales_activity_count × 100` | CALCULATED |
| `revenue_by_referral_source` | 紹介元別売上 | 紹介元経由で開始した利用者の売上を紹介元ごとに集計 | CALCULATED |
| `last_visit_date_by_source` | 最終訪問日 | 紹介元ごとの `SalesActivity.occurredAt` の最大値 | FACT |
| `sales_roi` | 営業ROI | `紹介元経由の増分売上 ÷ 営業活動コスト（人件費按分等）` | CALCULATED |

## 6.7 追加提案KPI（20章末尾の「その他必要な計算式」対応）

| kpiCode | 名称 | 式 | 用途 |
|---|---|---|---|
| `bed_fill_equivalent` | 拠点キャパシティ充足率 | `patient_count ÷ 拠点の標準対応可能利用者数` | 出店可能性/過稼働判定の補助 |
| `station_operating_profit` | 拠点別営業利益 | 拠点別 `revenue − labor_cost(按分) − 拠点固定費` | 拠点赤字判定(DR-18) |
| `referral_source_dormancy_days` | 紹介元休眠日数 | `今日 − last_visit_date_by_source` | 重要紹介元休眠判定(DR-12) |
| `forecast_required_nurses` | 必要看護師数（予測） | `forecast_total_visit_minutes ÷ (1人当たり標準訪問可能時間)` | 採用要否判定(DR-15,16) |
| `employee_workload_index` | 職員別負荷指数 | `本人の月間訪問時間 ÷ 拠点看護師の平均訪問時間` | 過稼働検知(DR-07)の個人単位補助指標 |

## 6.8 ゼロ除算・欠損値・異常値処理方針

| ケース | 処理 |
|---|---|
| 分母が0（例: FTEが0、営業件数が0） | KPI値は `null` を返し、`insufficientData: true` フラグを付与。UI上は「データ不足」と表示し、0%やInfinityを表示しない |
| 対象月のデータが存在しない | KPISnapshotを作成せず、Rule Engineは当該ルールをスキップ（Alertを発生させない） |
| 前月・前年同月データが欠損 | 比較系KPI（MoM/YoY）は `null` を返す。単月KPIは計算する |
| 異常値（例: 訪問時間が1件1440分＝24時間超） | Import時点でバリデーションエラーとして弾き、`DataImportBatch.errorDetail` に記録。既存データに紛れ込んだ場合はKPI計算時に外れ値として除外せず、そのまま計算した上でRule Engineの「データ品質アラート」（将来拡張）で検知する方針とし、サイレントな除外はしない |
| 負の値になり得ないKPI（人数・件数）が負になった | システムエラーとしてログに記録し、KPI値は前回値を保持（表示は「計算エラー」） |
| Cash Runwayの分母（Burn）が0以下 | 「Runway良好（黒字基調）」を意味する特別表示とし、無限大やnullを直接表示しない |

## 6.9 KPIの計算頻度と保存

- 日次バッチで当月分の全KPIを再計算し、`KPISnapshot` に upsert する（`yearMonth` 単位で最新値に更新）。
- 過去月のKPIは確定後は再計算しない（財務データの遡及修正があった場合のみ、Data Import経由で明示的に再計算をトリガー）。
