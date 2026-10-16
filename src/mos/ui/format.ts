// 表示用の書式
export function yen(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `${v < 0 ? "-" : ""}¥${Math.abs(v).toLocaleString("ja-JP")}`;
}

/** 万円表記（ダッシュボードのタイル用） */
export function man(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const m = v / 10000;
  return `${m.toLocaleString("ja-JP", { maximumFractionDigits: Math.abs(m) >= 100 ? 0 : 1 })}万円`;
}

export function pct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function num(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("ja-JP");
}

export function ymLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${y}年${m}月`;
}

export function dateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
