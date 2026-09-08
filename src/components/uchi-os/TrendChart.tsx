"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export interface TrendChartPoint {
  yearMonth: string;
  value: number | null;
}

export function TrendChart({ data, label, color = "#171717" }: { data: TrendChartPoint[]; label: string; color?: string }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="yearMonth" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 11 }} width={60} />
          <Tooltip />
          <Line type="monotone" dataKey="value" name={label} stroke={color} strokeWidth={2} dot={{ r: 2 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
