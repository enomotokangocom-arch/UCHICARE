/**
 * 1FTEあたりの標準訪問可能時間の仮定値(稼働率・必要看護師数予測の分母)。
 * ハードコードを避けるべき対象だが、組織別設定は未実装のため定数とする。
 * Phase2以降の Settings 拡張で AnomalyThreshold と同様に組織/拠点別の値へ移行できる
 * (06章・07章冒頭の方針、compute.ts / rules.ts / forecast.ts で共有する)。
 */
export const STANDARD_VISIT_MINUTES_PER_DAY = 360;
export const STANDARD_WORKING_DAYS_PER_MONTH = 20;
export const STANDARD_VISIT_MINUTES_PER_MONTH = STANDARD_VISIT_MINUTES_PER_DAY * STANDARD_WORKING_DAYS_PER_MONTH;
