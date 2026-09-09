// DR-12「重要紹介元休眠」用の紹介元別データ集計。
// KPI Engineの月次集計(compute.ts)とは別に、紹介元単位の粒度が必要なため専用に切り出す。

import { prisma } from "@/server/uchi-os/db/client";
import { monthRange, shiftYearMonth } from "./dates";

export interface ReferralSourceDetail {
  referralSourceId: string;
  name: string;
  lastActivityAt: Date | null;
  dormancyDays: number | null;
  trailing12moContribution: number; // 紹介による利用者数の合計(過去12ヶ月、売上そのものではなく件数ベースの代理指標)
  contributionRank: number; // 1が最大貢献
  isTopContributor: boolean; // 上位N%以内か
}

export async function getReferralSourceDetails(
  organizationId: string,
  stationId: string,
  asOfYearMonth: string,
  topContributionPct: number,
): Promise<ReferralSourceDetail[]> {
  const windowStart = monthRange(shiftYearMonth(asOfYearMonth, -11)).start;
  const windowEnd = monthRange(asOfYearMonth).end;

  const [sources, activities] = await Promise.all([
    prisma.referralSource.findMany({
      where: { organizationId, salesActivities: { some: { stationId } } },
      select: { id: true, name: true },
    }),
    prisma.salesActivity.findMany({
      where: { organizationId, stationId, occurredAt: { gte: windowStart, lt: windowEnd } },
      select: { referralSourceId: true, occurredAt: true, resultedInReferral: true, referredPatientCount: true },
    }),
  ]);

  const byId = new Map<string, { lastActivityAt: Date | null; contribution: number }>();
  for (const source of sources) {
    byId.set(source.id, { lastActivityAt: null, contribution: 0 });
  }
  for (const activity of activities) {
    if (!activity.referralSourceId) continue;
    const entry = byId.get(activity.referralSourceId);
    if (!entry) continue;
    if (!entry.lastActivityAt || activity.occurredAt > entry.lastActivityAt) {
      entry.lastActivityAt = activity.occurredAt;
    }
    if (activity.resultedInReferral) {
      entry.contribution += activity.referredPatientCount;
    }
  }

  const asOf = monthRange(asOfYearMonth).end;
  const ranked = sources
    .map((source) => {
      const entry = byId.get(source.id)!;
      const dormancyDays = entry.lastActivityAt
        ? Math.floor((asOf.getTime() - entry.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return {
        referralSourceId: source.id,
        name: source.name,
        lastActivityAt: entry.lastActivityAt,
        dormancyDays,
        trailing12moContribution: entry.contribution,
      };
    })
    .sort((a, b) => b.trailing12moContribution - a.trailing12moContribution);

  const topCount = Math.max(1, Math.ceil((ranked.length * topContributionPct) / 100));

  return ranked.map((item, index) => ({
    ...item,
    contributionRank: index + 1,
    isTopContributor: index < topCount && item.trailing12moContribution > 0,
  }));
}
