"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ymLabel } from "./format";

export function MonthPicker({ months, value }: { months: string[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-600">対象月</span>
      <select
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5"
        value={value}
        onChange={(e) => {
          const p = new URLSearchParams(params.toString());
          p.set("ym", e.target.value);
          router.push(`${pathname}?${p.toString()}`);
        }}
      >
        {[...months].reverse().map((m) => (
          <option key={m} value={m}>
            {ymLabel(m)}
          </option>
        ))}
      </select>
    </label>
  );
}
