import Link from "next/link";
import clsx from "clsx";
import { getSession } from "@/server/uchi-os/auth/session";
import { prisma } from "@/server/uchi-os/db/client";
import { formatYearMonth } from "@/server/uchi-os/kpi-engine/dates";
import { PageHeader } from "@/components/uchi-os/PageHeader";
import { ActionRow, type ActualImpact } from "@/components/uchi-os/actions/ActionRow";
import type { ActionStatus } from "@prisma/client";

const STATUS_TABS: { value: ActionStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "すべて" },
  { value: "AI_RECOMMENDED", label: "AI提案" },
  { value: "HUMAN_APPROVED", label: "承認済み" },
  { value: "IN_PROGRESS", label: "着手中" },
  { value: "COMPLETED", label: "完了" },
  { value: "RESULT_VERIFIED", label: "実績確認済み" },
  { value: "HELD", label: "保留中" },
  { value: "REJECTED", label: "却下" },
];

export default async function ActionCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { status } = await searchParams;
  const activeStatus = (status as ActionStatus | undefined) ?? undefined;

  const actions = await prisma.action.findMany({
    where: { organizationId: session.organizationId, ...(activeStatus ? { status: activeStatus } : {}) },
    include: { decision: { include: { station: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Action Center" yearMonth={formatYearMonth(new Date())} />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => {
          const isActive = tab.value === "ALL" ? !activeStatus : activeStatus === tab.value;
          return (
            <Link
              key={tab.value}
              href={tab.value === "ALL" ? "/uchi-os/actions" : `/uchi-os/actions?status=${tab.value}`}
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

      {actions.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
          該当するActionはありません。
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((a) => (
            <ActionRow
              key={a.id}
              action={{
                id: a.id,
                title: a.title,
                description: a.description,
                status: a.status,
                requiresApprovalCategory: a.requiresApprovalCategory,
                deadline: a.deadline ? a.deadline.toISOString() : null,
                stationName: a.decision.station?.name ?? "法人全体",
                ruleCode: a.decision.ruleCode,
                holdReason: a.holdReason,
                actualImpact: (a.actualImpact as unknown as ActualImpact | null) ?? null,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
