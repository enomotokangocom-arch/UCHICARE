"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CategoryAggregate } from "@/lib/types";
import { surveyDefs } from "@/lib/surveyDefs";

export function CategoryRadarChart({ data }: { data: CategoryAggregate[] }) {
  const chartData = data.map((c) => ({
    subject: surveyDefs[c.type].shortTitle,
    score: c.averageScore,
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={chartData} outerRadius="75%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: "#475569" }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
        <Radar
          name="健康スコア"
          dataKey="score"
          stroke="#0d9488"
          fill="#0d9488"
          fillOpacity={0.35}
        />
        <Tooltip formatter={(value) => [`${value}点`, "健康スコア"]} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
