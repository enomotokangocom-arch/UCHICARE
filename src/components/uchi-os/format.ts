export function formatYen(value: number | null): string {
  if (value == null) return "—";
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value == null) return "—";
  if (!Number.isFinite(value)) return "良好";
  return `${value.toFixed(digits)}%`;
}

export function formatNumber(value: number | null, digits = 0): string {
  if (value == null) return "—";
  if (!Number.isFinite(value)) return "∞";
  return value.toLocaleString("ja-JP", { maximumFractionDigits: digits });
}

export function formatMonths(value: number | null): string {
  if (value == null) return "—";
  if (!Number.isFinite(value)) return "良好（黒字基調）";
  return `${value.toFixed(1)}ヶ月`;
}
