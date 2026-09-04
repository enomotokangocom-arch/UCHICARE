# Forecast Engine 設計

すべて `src/lib/ceo/forecastEngine.ts` / `salesEngine.ts` / `productivityEngine.ts` に実装する、
副作用のない決定的関数群。乱数・LLM呼び出しは一切含まない。

## 売上予測(月末売上予測)

```
ForecastRevenue
  = ConfirmedRevenue                     // 当月MTD確定売上(revenueActualMtd)
  + ScheduledVisitRevenue                // 残日数のランレート予測分
  + ExpectedNewPatientRevenue            // 新規利用者による増収見込み
  + ExpectedResumptionRevenue            // 再開利用者による増収見込み
  - ExpectedDischargeImpact              // 終了利用者による減収見込み(残日数按分)
  - ExpectedHospitalizationImpact        // 入院による減収見込み
  - ExpectedCancellationImpact           // キャンセル率による減収見込み
  + ExpectedAddons                       // 加算の見込み

ScheduledVisitRevenue = (revenueActualMtd / daysElapsed) × (daysInMonth - daysElapsed)
ExpectedNewPatientRevenue     = newPatients × avgRevenuePerPatient × (残日数比率)
ExpectedResumptionRevenue     = resumedPatients × avgRevenuePerPatient × (残日数比率)
ExpectedDischargeImpact       = dischargedPatients × avgRevenuePerPatient × (残日数比率)
ExpectedHospitalizationImpact = hospitalizedPatients × avgRevenuePerPatient × 0.5 × (残日数比率)
ExpectedCancellationImpact    = ScheduledVisitRevenue × config.cancellationRate
ExpectedAddons                = ScheduledVisitRevenue × config.addonRate
```

達成確率(月末達成確率)は正規分布近似ではなくPhase 0では単純化し、
`gapRatio = (ForecastRevenue - RevenueBudget) / RevenueBudget` から
`probability = clamp(0.5 + gapRatio × 5, 0.05, 0.95)` として算出する(将来は過去実績の分散から
信頼区間を推定する統計モデルに置き換える拡張ポイント)。

## 利益予測

```
ForecastProfit = ForecastRevenue - LaborCost - VariableCost - FixedCost
ProfitGap      = ForecastProfit - ProfitBudget
```

`ProfitGap` を以下の要因に分解して提示する:

```
RevenueShortfall = min(0, ForecastRevenue - RevenueBudget)
LaborOverrun     = LaborCost - budgetedLaborCost(config比率)
OtherFixedOverrun = ProfitGap - RevenueShortfall - LaborOverrun
```

## 拠点別稼働率・生産性

```
UtilizationRate       = visitHours / availableHours
ClinicalUtilization   = visitProvidedHours / workHours
RevenueProductivity   = revenue / workHours
VisitProductivity     = visitCount / workDays
TravelEfficiency      = visitHours / (visitHours + travelHours)
```

## 30/90日利用者予測

直近3ヶ月の平均月次変化量を用いた単純トレンド予測(Expected/Low/Highの範囲付き)。

```
monthlyNetChange = avg(newPatients + resumedPatients - dischargedPatients - hospitalizedPatients, 過去3ヶ月)
ExpectedPatients(N日後) = currentPatients + monthlyNetChange × (N / 30)
LowPatients(N日後)      = Expected - stdev(過去3ヶ月の netChange) × (N / 30)
HighPatients(N日後)     = Expected + stdev(過去3ヶ月の netChange) × (N / 30)
```

## 供給不足予測・必要採用人数

```
avgVisitHoursPerPatient      = 直近月の visitHours / currentPatients
FutureRequiredVisitHours(h)  = ExpectedPatients(h日後) × avgVisitHoursPerPatient   // h日後時点の「月間換算」必要訪問時間
FutureAvailableStaffHours(h) = 直近月の availableHours                             // 採用がなければ変化しない前提(Phase1で退職予定等を反映)
CapacityGapHours(h)          = FutureRequiredVisitHours(h) - FutureAvailableStaffHours(h)
ShortageRatio(h)             = CapacityGapHours(h) / FutureRequiredVisitHours(h)
RequiredFTE                  = max(0, CapacityGapHours(h)) / config.avgProductiveHoursPerFte
RecruitmentStartDate         = ProjectedShortageDate - config.avgHiringLeadTimeDays
```

h = 30/60/90日の3点で評価し、`ShortageRatio(h)` が初めて閾値(5%/10%)を超える最小の h を
`ProjectedShortageDate = today + h` とする(Phase 0では離散3点評価とし、線形補間は行わない)。

## 必要新規利用者数・必要営業量

```
RevenueGap             = max(0, RevenueBudget - ForecastRevenue)
RequiredNewPatients     = RevenueGap / avgRevenuePerPatient
ReferralToContractCVR   = contracts / referrals
SalesToReferralCVR      = referrals / salesActivities
RequiredReferrals       = RequiredNewPatients / ReferralToContractCVR
RequiredSalesActivity   = RequiredReferrals / SalesToReferralCVR
```

CVRが0または算出不能な場合(データ不足)は `confidenceScore` を下げ、`explain.dataUsed` に
「紹介実績データ不足のため過去平均CVRで代替」等の注記を付与する。

## 会社全体スコア(0〜100)

```
CompanyHealthScore =
    35 × clamp(ForecastRevenue / RevenueBudget, 0, 1.1) / 1.1
  + 25 × clamp(ForecastProfit / ProfitBudget, 0, 1.1) / 1.1     // ProfitBudget<=0 の場合は達成=1として除外
  + 20 × clamp(UtilizationRate / config.targetUtilization, 0, 1)
  + 20 × (1 - severityPenalty)                                  // red Decision数 に応じた減点
```

各係数・閾値は `config.ts` に集約し、ハードコードしない。
