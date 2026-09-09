import { getSession } from "@/server/uchi-os/auth/session";
import { prisma } from "@/server/uchi-os/db/client";
import { formatYearMonth } from "@/server/uchi-os/kpi-engine/dates";
import { PageHeader } from "@/components/uchi-os/PageHeader";
import { ScenarioSimulator } from "@/components/uchi-os/scenarios/ScenarioSimulator";

export default async function ScenariosPage() {
  const session = await getSession();
  if (!session) return null;

  const [stations, scenarios] = await Promise.all([
    prisma.station.findMany({ where: { organizationId: session.organizationId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.scenario.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Scenario Simulator" yearMonth={formatYearMonth(new Date())} />
      <p className="mb-4 text-xs text-neutral-400">
        Calculation Engineによる決定論的な試算です（LLMは使用しません）。3ヶ月後の「何もしない場合」の
        トレンド予測を基準に、シナリオ適用後との差分を表示します。
      </p>
      <ScenarioSimulator
        stations={stations.map((s) => ({ id: s.id, name: s.name }))}
        history={scenarios.map((s) => ({
          id: s.id,
          name: s.name,
          inputParams: s.inputParams as never,
          resultSummary: s.resultSummary as never,
          createdAt: s.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
