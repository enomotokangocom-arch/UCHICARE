"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// バリデーション済みの2色(売上=青、目標=オレンジ)。目標は破線でも区別する。
const SERIES_REVENUE = "#2a78d6";
const SERIES_TARGET = "#eb6834";
const AXIS = { fontSize: 11, fill: "#64748b" };
const GRID = "#e2e8f0";

export type MonthPoint = { label: string; revenue: number | null; target: number | null; margin: number | null };

const man = (v: number) => `${Math.round(v / 10000).toLocaleString()}万`;
const yenFull = (v: unknown) => (typeof v === "number" ? `¥${Math.round(v).toLocaleString()}` : "-");

export function RevenueTargetChart({ data, height = 260 }: { data: MonthPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={man} width={52} />
        <Tooltip
          formatter={(v, name) => [yenFull(v), name]}
          cursor={{ fill: "rgba(100,116,139,0.08)" }}
          contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: GRID }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#475569" }} iconSize={10} />
        <Bar isAnimationActive={false} dataKey="revenue" name="売上" fill={SERIES_REVENUE} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Line
          isAnimationActive={false}
          dataKey="target"
          name="目標"
          stroke={SERIES_TARGET}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={{ r: 4, fill: SERIES_TARGET, stroke: "#fff", strokeWidth: 2 }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function MarginChart({ data, height = 200 }: { data: MonthPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data.map((d) => ({ ...d, marginPct: d.margin === null ? null : d.margin * 100 }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={44} />
        <ReferenceLine y={0} stroke="#94a3b8" />
        <Tooltip
          formatter={(v) => [typeof v === "number" ? `${v.toFixed(1)}%` : "-", "利益率"]}
          contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: GRID }}
        />
        <Line
          isAnimationActive={false}
          dataKey="marginPct"
          name="利益率"
          stroke={SERIES_REVENUE}
          strokeWidth={2}
          dot={{ r: 4, fill: SERIES_REVENUE, stroke: "#fff", strokeWidth: 2 }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
