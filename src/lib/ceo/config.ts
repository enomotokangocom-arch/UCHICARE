/**
 * 閾値・パラメータの一元管理(ハードコード禁止のため全Engineはここを参照する)。
 * 将来的にはDB(kpi_targets等)から組織ごとに読み込む想定。
 */
export const CEO_CONFIG = {
  organizationName: "株式会社Uchi care",

  revenue: {
    yellowGapRatio: 0.03, // 計画比 -3%
    redGapRatio: 0.05, // 計画比 -5%
    cancellationRate: 0.02,
    addonRate: 0.015,
    hospitalizationImpactFactor: 0.5,
  },

  branchPl: {
    redGapRatio: 0.1,
  },

  utilization: {
    targetRate: 0.8,
    yellowRate: 0.75,
    redRate: 0.65,
  },

  productivity: {
    lowClinicalUtilization: 0.55,
    lowTravelEfficiency: 0.75,
  },

  capacity: {
    // 供給不足予測の閾値(FutureRequiredVisitHoursに対する不足率)
    yellowShortageRatio: 0.05,
    redShortageRatio: 0.1,
    avgProductiveHoursPerFte: 140, // 1FTEあたり月間訪問可能時間
    avgHiringLeadTimeDays: 75,
    forecastHorizonDays: [30, 60, 90] as const,
  },

  sales: {
    // 紹介/契約実績が薄い場合に用いるフォールバックCVR
    fallbackReferralToContractCvr: 0.7,
    fallbackSalesToReferralCvr: 0.15,
  },

  companyScore: {
    revenueWeight: 35,
    profitWeight: 25,
    utilizationWeight: 20,
    severityWeight: 20,
  },

  priority: {
    // decisionType別の不可逆性係数(採用・営業戦略変更は高め)
    irreversibility: {
      revenue_forecast: 0.6,
      profit_forecast: 0.7,
      nurse_productivity: 0.4,
      required_new_patients: 0.6,
      required_sales_activity: 0.5,
      required_hiring: 0.85,
    } as Record<string, number>,
  },

  approvalLevel: {
    revenue_forecast: "L2",
    profit_forecast: "L2",
    nurse_productivity: "L2",
    required_new_patients: "L2",
    required_sales_activity: "L2",
    required_hiring: "L2", // 採用最終判断そのものはhuman_only。ここは「採用開始を検討すべき」という提案レベル
  } as Record<string, string>,

  maxTopDecisions: 5,
} as const;
