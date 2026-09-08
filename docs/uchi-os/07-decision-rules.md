# 7. 20 Decision Rules

各ルールは `ruleCode` (`DR-01`〜`DR-20`) で識別され、`AnomalyThreshold` テーブルにより
組織・拠点単位でパラメータを上書きできる（ハードコード禁止、07章冒頭の方針）。

## 7.0 共通仕様

### Confidence（信頼度）の共通算出方法

```
confidence = clamp( 0.4 × dataCompleteness + 0.4 × signalStrength + 0.2 × historicalPrior, 0, 1 )
```

- `dataCompleteness`（0-1）: ルール評価に必要なKPI/データ項目のうち、欠損なく揃っている割合
- `signalStrength`（0-1）: 閾値超過の度合い。`min(1, (実測値 − 閾値) / 閾値の基準幅)` のように正規化
- `historicalPrior`（0-1）: 過去に同ルールが発火した際、人間が「有用」と承認した割合（Phase1-3はデータ不足のため
  デフォルト0.6を仮値として使用し、Phase4のFeedback Loopで実データに置き換える）
- Confidence < 0.5 の場合、Decision/Action UIに **「判断保留を推奨」** ラベルを表示し、経営者が「保留」を選びやすくする（22章）

### Severity 共通定義

| Severity | 意味 |
|---|---|
| CRITICAL | 財務・事業継続に直接影響（例: Cash Runway逼迫、大幅な売上低下） |
| WARNING | 放置すると悪化する可能性が高い予兆 |
| INFO | 参考情報・注意喚起（即対応は必須でない） |

### Human Approval 共通ルール

11章の重要判断カテゴリ（採用/解雇/給与/人事評価/投資/借入/契約/出店/撤退）に該当するActionは、
Decision Engineが `Action.requiresApprovalCategory` を必ずセットし、Human Approvedになるまで
In Progressへ遷移できない（Action Engineのガード）。

### 検証方法（共通）

Actionが `Completed` になった後、`Action.expectedImpact` と同じKPIコードの実測値を
`actualImpact` として自動収集し `Result Verified` に遷移する（Phase2は手動記録、Phase4で自動化）。
差分は Feedback Loop（23章）でルールごとの `historicalPrior` 更新に使う。

---

## DR-01 売上低下

- **必要データ**: `monthly_revenue`（当月・前月）
- **計算式/Trigger**: `revenue_mom ≤ -閾値(default: -5%)`
- **Severity**: `revenue_mom ≤ -10%` → CRITICAL、`-10% < revenue_mom ≤ -5%` → WARNING
- **原因分析方法**: `net_patient_change`、`utilization_rate`、`new_patients` の当月変化を分解し、
  売上減少額に対する寄与度を按分計算（例: 終了者による訪問減少分 × 単価 ≒ 影響額）
- **推奨Action**: 影響拠点への営業集中、紹介実績のある紹介元への再訪、稼働率が低ければ配置転換検討
- **Human Approval**: 不要（分析・提案のみ。配置転換や採用停止等の派生Actionは各該当ルールの承認要件に従う）
- **Confidence**: 共通式。signalStrengthは `|revenue_mom| / 5%` を基準に正規化
- **検証方法**: 翌月の `revenue_mom` が回復したかを確認

## DR-02 売上予測未達

- **必要データ**: Forecast Engineの `revenue_forecast_month_end`、当月の月次予算（`FinancialRecord`に予算欄がない場合は前年同月実績を代替予算として使用）
- **計算式/Trigger**: `(revenue_forecast_month_end − budget) / budget ≤ -閾値(default: -5%)`
- **Severity**: 未達幅に応じてWARNING/CRITICAL
- **原因分析方法**: 月初からの実績推移とForecastの残り営業日数分の予測を分解し、「このままのペースだと」を説明
- **推奨Action**: 残営業日での訪問件数積み増し、新規利用開始の前倒し
- **Human Approval**: 不要
- **Confidence**: Forecast Engineの予測誤差（過去の予測 vs 実績の平均絶対誤差）を `signalStrength` に反映
- **検証方法**: 月末実績と予測の差分を記録し、予測モデルの精度指標に反映

## DR-03 利用者純減

- **必要データ**: `net_patient_change`
- **計算式/Trigger**: `net_patient_change < 0` が2ヶ月連続
- **Severity**: 2ヶ月連続 → WARNING、3ヶ月連続以上 → CRITICAL
- **原因分析方法**: `new_patients` と `ended_patients` の推移を分解し、どちらが主因かを判定
- **推奨Action**: 主因が新規減なら営業強化、終了増なら `PatientEvent` の `endReason` 内訳を確認し対応
- **Human Approval**: 不要
- **Confidence**: 連続月数が長いほど `signalStrength` 上昇
- **検証方法**: 翌月 `net_patient_change` が0以上に回復したか

## DR-04 終了者急増

- **必要データ**: `ended_patients`（直近12ヶ月の月平均と比較）
- **計算式/Trigger**: `当月ended_patients ≥ 直近12ヶ月平均 × 閾値(default: 1.5倍)` かつ 最低件数（default: 3件）以上
- **Severity**: 2倍以上 → CRITICAL、1.5〜2倍 → WARNING
- **原因分析方法**: `PatientEvent.endReason` の内訳集計（入院/死亡/転院/家族都合等）。特定の `endReason` に偏りがあれば明示
- **推奨Action**: `HOSPITALIZED`偏重なら医療連携先の確認、`FAMILY_REQUEST`偏重ならサービス品質・管理者ヒアリング
- **Human Approval**: 不要
- **Confidence**: サンプル数（件数）が少ないと `dataCompleteness` を下げる（小数のブレを過大評価しない）
- **検証方法**: 翌月の終了者数が平均域に戻ったか

## DR-05 新規利用者減少

- **必要データ**: `new_patients`（直近3ヶ月平均と比較）
- **計算式/Trigger**: `当月new_patients ≤ 直近3ヶ月平均 × 閾値(default: 0.7倍)`
- **Severity**: WARNING（`referral_rate`も同時低下していればCRITICALに格上げ）
- **原因分析方法**: `sales_activity_count`・`referral_rate`・`active_referral_sources`との相関を確認し、営業起因か外部要因かを分解
- **推奨Action**: 営業件数不足なら営業計画見直し、紹介率低下なら紹介元フォロー強化
- **Human Approval**: 不要
- **Confidence**: 営業KPIとの相関が強いほど `signalStrength` 上昇
- **検証方法**: 翌月 `new_patients` の回復

## DR-06 稼働率低下

- **必要データ**: `utilization_rate`
- **計算式/Trigger**: `utilization_rate < 閾値(default: 75%)`
- **Severity**: `<65%` → CRITICAL、`65-75%` → WARNING
- **原因分析方法**: 拠点内の職員別稼働率分布を確認し、全体低下か特定職員起因かを分解。`patient_count`減少との連動も確認
- **推奨Action**: 訪問スケジュール最適化、利用者増（営業強化）、必要に応じ採用停止（DR-16と連携）
- **Human Approval**: 不要（採用停止Actionが派生する場合はそちらで判断、承認不要だが記録は必須）
- **Confidence**: 閾値からの乖離幅で算出
- **検証方法**: 翌月 `utilization_rate` の推移

## DR-07 過稼働

- **必要データ**: `utilization_rate`、`employee_workload_index`
- **計算式/Trigger**: `utilization_rate > 閾値(default: 90%)` または個人の `employee_workload_index ≥ 1.3`
- **Severity**: 拠点全体で90%超 → WARNING、95%超または離職リスクの高い個人偏重 → CRITICAL
- **原因分析方法**: 拠点平均と個人値を比較し、特定職員への偏重かどうかを判定
- **推奨Action**: 業務配分の見直し、増員検討（DR-15と連携）、対象職員との面談
- **Human Approval**: 不要（増員Actionが承認要件を持つ場合は該当ルールで処理）
- **Confidence**: 継続月数と乖離幅の組み合わせ
- **検証方法**: 翌月の稼働率・離職の有無

## DR-08 人件費率上昇

- **必要データ**: `labor_cost_ratio`
- **計算式/Trigger**: `labor_cost_ratio ≥ 閾値(default: 60%)`
- **Severity**: `≥65%` → CRITICAL、`60-65%` → WARNING
- **原因分析方法**: 人件費増加要因（採用増/昇給/残業）と売上要因（低下）のどちらが主因かを、`labor_cost`と`revenue`それぞれの前月比で分解
- **推奨Action**: 稼働率改善による売上増、必要に応じた人員配置最適化（解雇等は原則対象外、要精査）
- **Human Approval**: 給与変更を伴うAction案は `SALARY` カテゴリで必須承認
- **Confidence**: 共通式
- **検証方法**: 翌月 `labor_cost_ratio` の推移

## DR-09 営業利益率低下

- **必要データ**: `operating_profit_margin`
- **計算式/Trigger**: `当月operating_profit_margin − 前月operating_profit_margin ≤ -閾値(default: -3pt)`
- **Severity**: 赤字転落（`operating_profit < 0`）→ CRITICAL、それ以外はWARNING
- **原因分析方法**: 売上要因と費用要因（`labor_cost_ratio`、`otherFixedCost`変化）への寄与度分解
- **推奨Action**: 主因に応じてDR-01/DR-08系のActionを優先提示
- **Human Approval**: 不要（コスト構造の変更を伴う場合は該当カテゴリで承認）
- **Confidence**: 共通式
- **検証方法**: 翌月の営業利益率

## DR-10 営業件数不足

- **必要データ**: `sales_activity_count`（直近3ヶ月平均と比較）
- **計算式/Trigger**: `当月sales_activity_count ≤ 直近3ヶ月平均 × 閾値(default: 0.6倍)`
- **Severity**: WARNING
- **原因分析方法**: 営業担当別の活動件数を比較し、特定担当起因か全体傾向かを分解
- **推奨Action**: 週次営業計画の見直し、優先紹介元リストの提示
- **Human Approval**: 不要
- **Confidence**: 共通式
- **検証方法**: 翌月の営業件数・新規利用者数の連動

## DR-11 営業紹介率低下

- **必要データ**: `referral_rate`
- **計算式/Trigger**: `当月referral_rate ≤ 直近3ヶ月平均 × 閾値(default: 0.7倍)`
- **Severity**: WARNING
- **原因分析方法**: 紹介元別の紹介率変化を分解し、特定紹介元の変化か全体傾向かを判定
- **推奨Action**: 低下している紹介元への関係強化、営業トークの見直し
- **Human Approval**: 不要
- **Confidence**: 共通式
- **検証方法**: 翌月の紹介率

## DR-12 重要紹介元休眠

- **必要データ**: `referral_source_dormancy_days`、紹介元別の過去12ヶ月売上貢献度
- **計算式/Trigger**: 過去12ヶ月の紹介元別売上貢献度で上位20%（または上位N件）に入る紹介元のうち、
  `referral_source_dormancy_days ≥ 閾値(default: 90日)`
- **Severity**: 貢献度上位ほどCRITICALに近づく（上位10%かつ120日以上でCRITICAL、それ以外はWARNING）
- **原因分析方法**: 過去の紹介実績推移と最終接触日を提示。訪問頻度低下時期を特定
- **推奨Action**: 優先再訪リストとして提示（担当営業をOwnerに設定）
- **Human Approval**: 不要
- **Confidence**: 貢献度データの十分性（12ヶ月分揃っているか）で `dataCompleteness` を調整
- **検証方法**: 再訪後の紹介再開有無

## DR-13 看護師不足

- **必要データ**: `utilization_rate`、`forecast_required_nurses`、`nurse_count`
- **計算式/Trigger**: `forecast_required_nurses − nurse_count ≥ 閾値(default: 1人)` かつ `utilization_rate` が高水準（DR-07近似）で3ヶ月継続予測
- **Severity**: 不足人数と継続期間で判定（2人以上不足の予測 → CRITICAL）
- **原因分析方法**: 利用者増加ペースと稼働率トレンドから必要人員を算出し、現員との差分を提示
- **推奨Action**: 採用開始（DR-15と連携してAction生成）
- **Human Approval**: `HIRING` カテゴリで必須承認
- **Confidence**: Forecast Engineの精度に依存、共通式に反映
- **検証方法**: 採用完了後の稼働率改善確認

## DR-14 看護師過剰

- **必要データ**: `utilization_rate`（低水準が継続）、`nurse_count`
- **計算式/Trigger**: `utilization_rate < 閾値(default: 60%)` が3ヶ月連続
- **Severity**: WARNING（雇用への影響が大きいため原則CRITICAL化しない）
- **原因分析方法**: 利用者数推移と職員数推移を突き合わせ、需給ギャップを定量化
- **推奨Action**: 新規採用停止（DR-16）、営業強化による稼働率改善を優先提示。人員削減は直接提案しない（重大判断のため経営者の総合判断に委ねる）
- **Human Approval**: 人員数に関わるAction（配置転換等）は状況に応じ `HIRING`/`TERMINATION` カテゴリで承認
- **Confidence**: 共通式
- **検証方法**: 翌月以降の稼働率推移

## DR-15 採用必要性

- **必要データ**: `forecast_required_nurses`、`nurse_count`、`turnover_rate`
- **計算式/Trigger**: DR-13の条件、または `turnover_rate` の上昇により将来的な欠員が見込まれる場合
- **Severity**: WARNING〜CRITICAL（DR-13と同じ基準を流用）
- **原因分析方法**: 需要側（利用者増予測）と供給側（離職予測）の両面から必要採用数を算出
- **推奨Action**: 採用計画（人数・職種・拠点・時期）を提示
- **Human Approval**: `HIRING` カテゴリで必須承認
- **Confidence**: 共通式
- **検証方法**: 採用実行後の稼働率・欠員解消状況

## DR-16 採用停止

- **必要データ**: `utilization_rate`（低水準）、`labor_cost_ratio`（高水準）、`RecruitmentRecord`（進行中の採用有無）
- **計算式/Trigger**: DR-14またはDR-08の条件を満たし、かつ `RecruitmentRecord.status IN (OPEN, INTERVIEWING, OFFERED)` が存在
- **Severity**: WARNING
- **原因分析方法**: 稼働率・人件費率の悪化トレンドと進行中採用のコストインパクトを提示
- **推奨Action**: 進行中採用の一時保留を提案
- **Human Approval**: `HIRING` カテゴリで必須承認（停止判断も採用に関する重要判断として扱う）
- **Confidence**: 共通式
- **検証方法**: 停止後の稼働率・人件費率推移

## DR-17 Cash Runway低下

- **必要データ**: `cash_runway_months`
- **計算式/Trigger**: `cash_runway_months < 閾値(default: 6ヶ月)`
- **Severity**: `<3ヶ月` → CRITICAL、`3-6ヶ月` → WARNING
- **原因分析方法**: `monthly_net_burn` の推移と主要因（売上減/費用増）を分解
- **推奨Action**: コスト削減案、資金調達（借入）の検討提示、拠点別赤字（DR-18）の確認を促す
- **Human Approval**: 借入・投資に関するActionは `LOAN`/`INVESTMENT` カテゴリで必須承認
- **Confidence**: `monthly_net_burn` の変動幅が大きいほど `dataCompleteness`（安定性）を下げる
- **検証方法**: 翌月のRunway改善

## DR-18 拠点赤字

- **必要データ**: `station_operating_profit`
- **計算式/Trigger**: `station_operating_profit < 0` が2ヶ月連続
- **Severity**: 2ヶ月連続 → WARNING、3ヶ月以上連続 → CRITICAL
- **原因分析方法**: 拠点の売上・人件費・固定費の内訳から赤字要因を分解
- **推奨Action**: 拠点特化の改善計画（DR-01/06/08系Actionの束ね）、改善が見込めない場合は撤退検討（DR-20）へのエスカレーション
- **Human Approval**: 不要（撤退判断そのものはDR-20側で承認必須）
- **Confidence**: 共通式
- **検証方法**: 翌月以降の拠点営業利益推移

## DR-19 出店可能性

- **必要データ**: 全社の `cash_runway_months`、`operating_profit_margin`、既存拠点の `utilization_rate` 平均、`bed_fill_equivalent`
- **計算式/Trigger**: `cash_runway_months ≥ 閾値(default: 12ヶ月)` かつ `operating_profit_margin ≥ 閾値(default: 10%)` かつ 既存拠点平均稼働率 `≥ 80%`（供給余力の枯渇＝需要はあるが応えられていない状態）
- **Severity**: INFO（機会提示であり緊急対応ではない）
- **原因分析方法**: 財務余力・既存拠点の需給逼迫状況を根拠として提示
- **推奨Action**: Scenario Simulatorでの出店シミュレーション実施を提案
- **Human Approval**: `NEW_STATION` カテゴリで必須承認
- **Confidence**: 財務指標の安定性（過去6ヶ月の分散）を `dataCompleteness` に反映
- **検証方法**: 出店判断後の初期稼働推移（長期）

## DR-20 撤退検討

- **必要データ**: `station_operating_profit`（長期赤字）、`cash_runway_months`（全社）、`utilization_rate`（低水準）
- **計算式/Trigger**: DR-18が6ヶ月以上連続 かつ 改善Actionが実行済みでも `station_operating_profit` が改善しない
- **Severity**: CRITICAL
- **原因分析方法**: 赤字継続期間、実施済みActionとその効果（`actualImpact`）、市場環境（`patient_count`推移）を総合提示
- **推奨Action**: 撤退／縮小／統合の選択肢を財務影響と共に提示（最終判断はしない）
- **Human Approval**: `WITHDRAWAL` カテゴリで必須承認（経営会議での議題化を前提とする文言をUIに明記）
- **Confidence**: 実施済みActionの効果検証データが多いほど `historicalPrior` 上昇
- **検証方法**: 撤退判断後の全社財務影響（長期）
