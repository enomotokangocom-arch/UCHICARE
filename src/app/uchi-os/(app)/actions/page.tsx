import { getSession } from "@/server/uchi-os/auth/session";
import { prisma } from "@/server/uchi-os/db/client";
import { formatYearMonth } from "@/server/uchi-os/kpi-engine/dates";
import { PageHeader } from "@/components/uchi-os/PageHeader";
import { ActionRow } from "@/components/uchi-os/actions/ActionRow";

export default async function ActionCenterPage() {
  const session = await getSession();
  if (!session) return null;

  const actions = await prisma.action.findMany({
    where: { organizationId: session.organizationId },
    include: { decision: { include: { station: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Action Center" yearMonth={formatYearMonth(new Date())} />

      {actions.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
          現在Actionはありません。
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
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
