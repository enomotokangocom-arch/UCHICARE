"use client";

import {
  Bar,
  Cell,
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

// ブランドの紺・金に寄せたうえで、色覚の違いでも見分けられることを検証済みの2色(売上=紺、目標=金)。目標は破線でも区別する。
const SERIES_REVENUE = "#2f5b94";
const SERIES_TARGET = "#c2a14e";
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
        <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} formatter={(value) => <span style={{ color: "#475569" }}>{value}</span>} />
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

export type PersonalPoint = {
  month: string;
  label: string;
  revenue: number | null;
  target: number | null;
  visits: number | null;
  minutes: number | null;
};

/**
 * 個人の売上(直近6か月)。棒にマウスを合わせると、その月の売上・目標・件数・時間を表示。
 * 棒を押すとその月を選び(onSelect)、選んだ月の棒を濃く表示する。利益ラインは横の線で表示。
 */
export function PersonalSalesChart({
  data,
  selected,
  onSelect,
  profitLine,
  height = 240,
}: {
  data: PersonalPoint[];
  selected?: string;
  onSelect?: (month: string) => void;
  profitLine?: number | null;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={data}
        margin={{ top: 16, right: 8, left: 0, bottom: 0 }}
        onClick={(e) => {
          const i = typeof e?.activeTooltipIndex === "number" ? e.activeTooltipIndex : Number(e?.activeTooltipIndex);
          const p = Number.isFinite(i) ? data[i] : undefined;
          if (p && onSelect) onSelect(p.month);
        }}
        style={{ cursor: onSelect ? "pointer" : undefined }}
      >
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={man} width={52} />
        <Tooltip
          cursor={{ fill: "rgba(100,116,139,0.08)" }}
          contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: GRID }}
          content={({ active, payload }) => {
            const p = active && payload?.[0] ? (payload[0].payload as PersonalPoint) : null;
            if (!p) return null;
            const h = p.minutes ? `${Math.floor(p.minutes / 60)}時間${p.minutes % 60 ? `${p.minutes % 60}分` : ""}` : "-";
            return (
              <div style={{ background: "#fff", border: `1px solid ${GRID}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, lineHeight: 1.7 }}>
                <div style={{ fontWeight: 700 }}>{p.month.replace("-", "年")}月</div>
                <div>売上 <b>{yenFull(p.revenue)}</b></div>
                <div>目標 {yenFull(p.target)}</div>
                {profitLine ? <div>利益ライン {yenFull(profitLine)}</div> : null}
                <div>訪問 {p.visits ?? "-"}件 ・ {h}</div>
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} formatter={(value) => <span style={{ color: "#475569" }}>{value}</span>} />
        <Bar
          isAnimationActive={false}
          dataKey="revenue"
          name="売上"
          fill={SERIES_REVENUE}
          radius={[4, 4, 0, 0]}
          maxBarSize={36}
          onClick={(d) => {
            const m = (d as { payload?: PersonalPoint })?.payload?.month;
            if (m && onSelect) onSelect(m);
          }}
        >
          {data.map((d) => (
            <Cell key={d.month} fill={SERIES_REVENUE} fillOpacity={!selected || selected === d.month ? 1 : 0.4} />
          ))}
        </Bar>
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
        {profitLine ? (
          <ReferenceLine
            y={profitLine}
            stroke="#be123c"
            strokeDasharray="2 3"
            label={{ value: `利益ライン ${man(profitLine)}`, position: "insideTopRight", fontSize: 11, fill: "#be123c" }}
          />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
