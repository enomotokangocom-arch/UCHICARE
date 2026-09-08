import { getSession } from "@/server/uchi-os/auth/session";
import { prisma } from "@/server/uchi-os/db/client";
import { formatYearMonth } from "@/server/uchi-os/kpi-engine/dates";
import { PageHeader } from "@/components/uchi-os/PageHeader";
import { DataSourceBadge } from "@/components/uchi-os/DataSourceBadge";
import clsx from "clsx";

const PRIORITY_STYLE: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700",
  HIGH: "bg-amber-50 text-amber-700",
  MEDIUM: "bg-blue-50 text-blue-700",
  LOW: "bg-neutral-100 text-neutral-600",
};

interface RootCauseFactor {
  label: string;
  value: number | null;
}

export default async function DecisionsPage() {
  const session = await getSession();
  if (!session) return null;

  const decisions = await prisma.decision.findMany({
    where: { organizationId: session.organizationId },
    include: { station: { select: { name: true } }, actions: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="AI Decisions" yearMonth={formatYearMonth(new Date())} />

      {decisions.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
          現在Decisionはありません。
        </div>
      ) : (
        <div className="space-y-3">
          {decisions.map((d) => {
            const factors = ((d.rootCause as { factors?: RootCauseFactor[] } | null)?.factors ?? []).filter(
              (f) => f.value != null,
            );
            return (
              <div key={d.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <span className={clsx("rounded px-1.5 py-0.5 text-[11px] font-medium", PRIORITY_STYLE[d.priority])}>
                    {d.priority}
                  </span>
                  <span className="text-xs text-neutral-400">{d.ruleCode}</span>
                  <span className="text-xs text-neutral-400">{d.station?.name ?? "法人全体"}</span>
                  <span className="ml-auto text-xs text-neutral-400">{d.status}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-neutral-900">{d.problemSummary}</p>
                {factors.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-600">
                    {factors.map((f, i) => (
                      <li key={i} className="rounded bg-neutral-50 px-2 py-1">
                        {f.label}: {f.value?.toLocaleString("ja-JP")}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex items-center gap-1.5">
                  <DataSourceBadge kind="CALCULATED" confidence={d.confidence} />
                  <span className="text-xs text-neutral-400">Actions: {d.actions.length}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
