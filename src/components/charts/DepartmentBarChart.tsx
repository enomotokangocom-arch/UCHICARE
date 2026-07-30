"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DepartmentAggregate } from "@/lib/types";
import { RISK_LEVEL_COLOR, scoreToLevel } from "@/lib/scoring";

export function DepartmentBarChart({ data }: { data: DepartmentAggregate[] }) {
  const chartData = data.map((d) => ({
    department: d.department,
    score: d.overallScore,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="department" tick={{ fontSize: 11, fill: "#475569" }} interval={0} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#475569" }} />
        <Tooltip formatter={(value) => [`${value}点`, "総合スコア"]} />
        <Bar dataKey="score" radius={[6, 6, 0, 0]}>
          {chartData.map((entry) => (
            <Cell key={entry.department} fill={RISK_LEVEL_COLOR[scoreToLevel(entry.score)]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
