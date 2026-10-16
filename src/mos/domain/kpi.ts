// 経営ダッシュボードの業務指標。データがない指標は 0 ではなく null（＝データなし）にする。
import type { MonthPL } from "./pl";
import { JOB_TYPE_LABEL, type BusinessUnit, type JobType, type Unit } from "./types";

export type VisitLite = {
  source: "ZEST" | "IBOW";
  kind: "SCHEDULED" | "ACTUAL";
  unit: Unit;
  jobType: JobType | null;
  cancelled: boolean;
  minutes: number | null;
  subjectKey: string | null;
  category?: string | null;
};

export type KpiInput = {
  yearMonth: string;
  visits: VisitLite[];
  metrics: { source: "ZEST" | "IBOW"; metricKey: string; unit: Unit; value: number }[];
  /** 居宅売上管理表の今月請求件数（要介護＋要支援）。データがなければ null */
  kyotakuBilledUsers: number | null;
  capacity: { unit: Unit; jobType: JobType; headcount: number; availableMinutes: number }[];
  targets: { unit: Unit; metric: "REVENUE" | "OPERATING_PROFIT" | "VISITS"; value: number }[];
  pl: MonthPL;
};

export type TargetProgress = {
  unit: Unit;
  metric: "REVENUE" | "OPERATING_PROFIT" | "VISITS";
  target: number;
  actual: number | null;
  rate: number | null;
};

export type MonthKpi = {
  yearMonth: string;
  visits: {
    actual: number | null; // iBow 実施実績（キャンセル除く）
    scheduled: number | null; // ZEST 予定（キャンセル除く）
    cancelledActualSource: number | null; // iBow でキャンセル扱いの件数
    cancelledScheduleSource: number | null; // ZEST でキャンセル扱いの件数
    byUnit: Partial<Record<BusinessUnit, number>>;
  };
  /** homonkango: iBow 実施実績の実利用者数 / zestUsers: ZEST の利用者数（予定ベース） / kyotaku: 今月請求件数 */
  users: { homonkango: number | null; kyotaku: number | null; zestUsers: number | null };
  /** 稼働可能時間が設定されていれば iBow 実施時間から計算、無ければ ZEST の職種別稼働率 */
  utilization: { label: string; rate: number | null; source: "CAPACITY" | "ZEST"; actualMinutes?: number; availableMinutes?: number; headcount?: number }[];
  /** iBow 実施実績の訪問種別（介護・医療・予防・自費）ごとの件数と時間 */
  byCategory: { category: string; visits: number; minutes: number }[];
  actualMinutes: number | null;
  targets: TargetProgress[];
  zestMetrics: Record<string, number>;
};

export function computeKpi(input: KpiInput): MonthKpi {
  const ibow = input.visits.filter((v) => v.source === "IBOW" && v.kind === "ACTUAL");
  const zest = input.visits.filter((v) => v.source === "ZEST" && v.kind === "SCHEDULED");
  const done = ibow.filter((v) => !v.cancelled);

  const byUnit: Partial<Record<BusinessUnit, number>> = {};
  for (const v of done) if (v.unit === "HOMONKANGO" || v.unit === "KYOTAKU") byUnit[v.unit] = (byUnit[v.unit] ?? 0) + 1;

  const subjects = new Set(done.filter((v) => v.unit === "HOMONKANGO" && v.subjectKey).map((v) => v.subjectKey!));
  const hasSubjectIds = done.some((v) => v.subjectKey);

  const minutesByJob = new Map<JobType, number>();
  for (const v of done) if (v.jobType && v.minutes !== null) minutesByJob.set(v.jobType, (minutesByJob.get(v.jobType) ?? 0) + v.minutes);
  const capByJob = new Map<JobType, { minutes: number; headcount: number }>();
  for (const c of input.capacity) {
    const cur = capByJob.get(c.jobType) ?? { minutes: 0, headcount: 0 };
    capByJob.set(c.jobType, { minutes: cur.minutes + c.availableMinutes, headcount: cur.headcount + c.headcount });
  }
  const zestMetric = (key: string) => {
    const m = input.metrics.filter((x) => x.source === "ZEST" && x.metricKey === key);
    return m.length ? m.reduce((s, x) => s + x.value, 0) : null;
  };
  let utilization: MonthKpi["utilization"] = [...capByJob.entries()].map(([jobType, cap]) => {
    const actualMinutes = minutesByJob.get(jobType) ?? 0;
    return {
      label: JOB_TYPE_LABEL[jobType],
      source: "CAPACITY" as const,
      actualMinutes,
      availableMinutes: cap.minutes,
      headcount: cap.headcount,
      rate: ibow.length > 0 && cap.minutes > 0 ? actualMinutes / cap.minutes : null,
    };
  });
  if (utilization.length === 0) {
    utilization = input.metrics
      .filter((m) => m.source === "ZEST" && m.metricKey.startsWith("UTIL_JOB:"))
      .map((m) => ({ label: m.metricKey.slice("UTIL_JOB:".length), rate: m.value, source: "ZEST" as const }))
      .sort((a, b) => b.rate - a.rate);
  }
  const catMap = new Map<string, { visits: number; minutes: number }>();
  for (const v of done) {
    if (!v.category) continue;
    const cur = catMap.get(v.category) ?? { visits: 0, minutes: 0 };
    catMap.set(v.category, { visits: cur.visits + 1, minutes: cur.minutes + (v.minutes ?? 0) });
  }

  const actualFor = (unit: Unit, metric: TargetProgress["metric"]): number | null => {
    const pl = unit === "COMPANY" ? input.pl.company : unit === "HQ" ? null : input.pl.units[unit];
    if (metric === "REVENUE") return pl?.revenue ?? null;
    if (metric === "OPERATING_PROFIT") return pl?.operatingProfit ?? null;
    if (ibow.length === 0) return null;
    return unit === "COMPANY" ? done.length : unit === "HQ" ? null : (byUnit[unit] ?? 0);
  };
  const targets = input.targets.map((t) => {
    const actual = actualFor(t.unit, t.metric);
    return { ...t, target: t.value, actual, rate: actual !== null && t.value !== 0 ? actual / t.value : null };
  });

  const zestMetrics: Record<string, number> = {};
  for (const m of input.metrics.filter((x) => x.source === "ZEST")) zestMetrics[m.metricKey] = (zestMetrics[m.metricKey] ?? 0) + m.value;

  return {
    yearMonth: input.yearMonth,
    visits: {
      actual: ibow.length ? done.length : null,
      scheduled: zest.length ? zest.filter((v) => !v.cancelled).length : zestMetric("VISITS_PLANNED"),
      cancelledActualSource: ibow.length ? ibow.filter((v) => v.cancelled).length : null,
      cancelledScheduleSource: zest.length ? zest.filter((v) => v.cancelled).length : zestMetric("CANCELLATIONS"),
      byUnit,
    },
    users: { homonkango: hasSubjectIds ? subjects.size : null, kyotaku: input.kyotakuBilledUsers, zestUsers: zestMetric("USERS") },
    utilization,
    byCategory: [...catMap.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.visits - a.visits),
    actualMinutes: ibow.length ? done.reduce((s, v) => s + (v.minutes ?? 0), 0) : null,
    targets,
    zestMetrics,
  };
}
