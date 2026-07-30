"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MonthlyTrendPoint } from "@/lib/types";
import { surveyDefs } from "@/lib/surveyDefs";

const LINE_COLORS: Record<string, string> = {
  ergonomics: "#2563eb",
  stressCheck: "#7c3aed",
  backPain: "#ea580c",
  caregiving: "#0d9488",
};

export function TrendLineChart({ data }: { data: MonthlyTrendPoint[] }) {
  const chartData = data.map((point) => ({
    label: point.label,
    総合スコア: point.overallScore,
    ...Object.fromEntries(
      Object.entries(point.categoryScores).map(([type, score]) => [
        surveyDefs[type as keyof typeof surveyDefs].shortTitle,
        score,
      ])
    ),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#475569" }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#475569" }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="総合スコア"
          stroke="#0f172a"
          strokeWidth={2.5}
          dot={{ r: 3 }}
        />
        {Object.entries(surveyDefs).map(([type, def]) => (
          <Line
            key={type}
            type="monotone"
            dataKey={def.shortTitle}
            stroke={LINE_COLORS[type]}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={{ r: 2 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
