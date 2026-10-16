"use client";
// 月次推移チャート。色は検証済みの2色（訪問看護=青・居宅支援=橙）。凡例と表表示を必ず併設する。
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const SERIES_COLOR = { HOMONKANGO: "#2a78d6", KYOTAKU: "#eb6834" } as const;

export type TrendPoint = {
  label: string;
  HOMONKANGO: number | null;
  KYOTAKU: number | null;
  companyRevenue: number | null;
  operatingProfit: number | null;
  status: string;
};

const axisYen = (v: number) => `${Math.round(v / 10000).toLocaleString("ja-JP")}万`;
const fullYen = (v: unknown) => (typeof v === "number" ? `¥${v.toLocaleString("ja-JP")}` : "—");

const axisProps = {
  tick: { fill: "#52514e", fontSize: 12 },
  axisLine: { stroke: "#d4d4d0" },
  tickLine: false,
} as const;

export function RevenueTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div>
      <div className="h-64 w-full" role="img" aria-label="事業所別売上の月次推移（積み上げ棒グラフ）">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#ecebe8" />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis tickFormatter={axisYen} width={64} {...axisProps} />
            <Tooltip formatter={fullYen} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: "#52514e" }}>{v}</span>} />
            <Bar dataKey="HOMONKANGO" name="訪問看護" stackId="r" fill={SERIES_COLOR.HOMONKANGO} stroke="#fff" strokeWidth={2} />
            <Bar dataKey="KYOTAKU" name="居宅支援" stackId="r" fill={SERIES_COLOR.KYOTAKU} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TrendTable data={data} />
    </div>
  );
}

export function ProfitTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-56 w-full" role="img" aria-label="全社営業利益の月次推移（棒グラフ）">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#ecebe8" />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis tickFormatter={axisYen} width={64} {...axisProps} />
          <ReferenceLine y={0} stroke="#8a8984" />
          <Tooltip formatter={fullYen} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="operatingProfit" name="全社営業利益" fill={SERIES_COLOR.HOMONKANGO} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendTable({ data }: { data: TrendPoint[] }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-slate-600">表で見る</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[480px] text-right">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-1 text-left">月</th>
              <th>訪問看護</th>
              <th>居宅支援</th>
              <th>全社売上</th>
              <th>営業利益</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-t border-slate-100">
                <td className="py-1 text-left">{d.label}</td>
                <td>{fullYen(d.HOMONKANGO)}</td>
                <td>{fullYen(d.KYOTAKU)}</td>
                <td>{fullYen(d.companyRevenue)}</td>
                <td>{fullYen(d.operatingProfit)}</td>
                <td>{d.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
