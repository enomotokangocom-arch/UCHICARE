import { getSession } from "@/server/uchi-os/auth/session";
import { prisma } from "@/server/uchi-os/db/client";
import { formatYearMonth } from "@/server/uchi-os/kpi-engine/dates";
import { PageHeader } from "@/components/uchi-os/PageHeader";
import clsx from "clsx";

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700",
  WARNING: "bg-amber-50 text-amber-700",
  INFO: "bg-blue-50 text-blue-700",
};

export default async function AlertsPage() {
  const session = await getSession();
  if (!session) return null;

  const alerts = await prisma.alert.findMany({
    where: { organizationId: session.organizationId },
    include: { station: { select: { name: true } } },
    orderBy: [{ detectedAt: "desc" }],
    take: 100,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Alerts" yearMonth={formatYearMonth(new Date())} />

      {alerts.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
          現在Alertはありません。
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div key={alert.id} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={clsx("rounded px-1.5 py-0.5 text-[11px] font-medium", SEVERITY_STYLE[alert.severity])}>
                    {alert.severity}
                  </span>
                  <span className="text-xs text-neutral-400">{alert.ruleCode}</span>
                  <span className="text-xs text-neutral-400">{alert.station?.name ?? "法人全体"}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-neutral-900">{alert.title}</p>
              </div>
              <div className="text-right text-xs text-neutral-400">
                <p>{alert.detectedAt.toLocaleDateString("ja-JP")}</p>
                <p>{alert.status}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
