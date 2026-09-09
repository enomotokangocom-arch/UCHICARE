import Link from "next/link";
import clsx from "clsx";
import { getSession } from "@/server/uchi-os/auth/session";
import { prisma } from "@/server/uchi-os/db/client";
import { formatYearMonth } from "@/server/uchi-os/kpi-engine/dates";
import { PageHeader } from "@/components/uchi-os/PageHeader";
import { AlertRow } from "@/components/uchi-os/alerts/AlertRow";
import type { AlertStatus } from "@prisma/client";

const STATUS_TABS: { value: AlertStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "すべて" },
  { value: "OPEN", label: "未対応" },
  { value: "ACKNOWLEDGED", label: "確認済み" },
  { value: "RESOLVED", label: "解消" },
  { value: "DISMISSED", label: "却下" },
];

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { status } = await searchParams;
  const activeStatus = (status as AlertStatus | undefined) ?? undefined;

  const alerts = await prisma.alert.findMany({
    where: { organizationId: session.organizationId, ...(activeStatus ? { status: activeStatus } : {}) },
    include: { station: { select: { name: true } } },
    orderBy: [{ detectedAt: "desc" }],
    take: 100,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Alerts" yearMonth={formatYearMonth(new Date())} />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => {
          const isActive = tab.value === "ALL" ? !activeStatus : activeStatus === tab.value;
          return (
            <Link
              key={tab.value}
              href={tab.value === "ALL" ? "/uchi-os/alerts" : `/uchi-os/alerts?status=${tab.value}`}
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

      {alerts.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
          該当するAlertはありません。
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={{
                id: alert.id,
                ruleCode: alert.ruleCode,
                severity: alert.severity,
                title: alert.title,
                stationName: alert.station?.name ?? "法人全体",
                status: alert.status,
                detectedAt: alert.detectedAt.toISOString(),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
