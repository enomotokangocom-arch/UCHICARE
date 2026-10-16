// 横棒の一覧（経費内訳・稼働率など）。値は常に文字で併記する。
export function BarList({
  items,
  format,
  max,
}: {
  items: { label: string; value: number | null; note?: string }[];
  format: (v: number | null) => string;
  max?: number;
}) {
  const top = max ?? Math.max(1, ...items.map((i) => Math.abs(i.value ?? 0)));
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label} className="text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-slate-700">{i.label}</span>
            <span className="shrink-0 font-medium tabular-nums text-slate-900">
              {format(i.value)}
              {i.note && <span className="ml-1 text-xs font-normal text-slate-500">{i.note}</span>}
            </span>
          </div>
          <div className="mt-1 h-2 rounded bg-slate-100">
            <div className="h-2 rounded bg-[#2a78d6]" style={{ width: `${Math.min(100, (Math.abs(i.value ?? 0) / top) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
