import Link from "next/link";
import clsx from "clsx";
import { getSession } from "@/server/uchi-os/auth/session";
import { prisma } from "@/server/uchi-os/db/client";
import { formatYearMonth } from "@/server/uchi-os/kpi-engine/dates";
import { PageHeader } from "@/components/uchi-os/PageHeader";
import { DecisionRow } from "@/components/uchi-os/decisions/DecisionRow";
import type { DecisionStatus } from "@prisma/client";

const STATUS_TABS: { value: DecisionStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "すべて" },
  { value: "AI_RECOMMENDED", label: "AI提案" },
  { value: "HUMAN_REVIEWED", label: "対応中" },
  { value: "DISMISSED", label: "却下" },
];

export default async function DecisionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { status } = await searchParams;
  const activeStatus = (status as DecisionStatus | undefined) ?? undefined;

  const decisions = await prisma.decision.findMany({
    where: { organizationId: session.organizationId, ...(activeStatus ? { status: activeStatus } : {}) },
    include: { station: { select: { name: true } }, actions: true, alert: { select: { status: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="AI Decisions" yearMonth={formatYearMonth(new Date())} />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => {
          const isActive = tab.value === "ALL" ? !activeStatus : activeStatus === tab.value;
          return (
            <Link
              key={tab.value}
              href={tab.value === "ALL" ? "/uchi-os/decisions" : `/uchi-os/decisions?status=${tab.value}`}
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-medium",
                isActive ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {decisions.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
          該当するDecisionはありません。
        </div>
      ) : (
        <div className="space-y-3">
          {decisions.map((d) => (
            <DecisionRow
              key={d.id}
              decision={{
                id: d.id,
                ruleCode: d.ruleCode,
                priority: d.priority,
                status: d.status,
                stationName: d.station?.name ?? "法人全体",
                problemSummary: d.problemSummary,
                rootCause: d.rootCause as { factors?: { label: string; value: number | null }[] } | null,
                confidence: d.confidence,
                actionCount: d.actions.length,
                alertStatus: d.alert?.status ?? null,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
