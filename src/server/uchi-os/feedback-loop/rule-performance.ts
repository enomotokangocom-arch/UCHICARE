import { prisma } from "@/server/uchi-os/db/client";
import { evaluateImpact } from "./impact-evaluation";
import type { ExpectedImpact, ActualImpact } from "./types";

export interface RulePerformance {
  ruleCode: string;
  sampleSize: number; // 判定可能だった(EXCEEDED/MET/PARTIAL/MISSEDのいずれか)Result Verified件数
  successRate: number | null; // (EXCEEDED+MET) / sampleSize
}

/**
 * 「このルールから生成されたActionのうち、期待効果を達成した割合」を集計する。
 * 07章冒頭のConfidence共通式における historicalPrior の実データソースとなる
 * (Phase1-3はデータ不足のため既定値0.6、Phase4以降はここで置き換える)。
 */
export async function computeAllRulePerformance(organizationId: string): Promise<Record<string, RulePerformance>> {
  const verifiedActions = await prisma.action.findMany({
    where: { organizationId, status: "RESULT_VERIFIED" },
    select: { expectedImpact: true, actualImpact: true, decision: { select: { ruleCode: true } } },
  });

  const tally = new Map<string, { success: number; evaluated: number }>();
  for (const action of verifiedActions) {
    const verdict = evaluateImpact(
      action.expectedImpact as unknown as ExpectedImpact | null,
      action.actualImpact as unknown as ActualImpact | null,
    );
    if (verdict === "UNKNOWN") continue;

    const ruleCode = action.decision.ruleCode;
    const entry = tally.get(ruleCode) ?? { success: 0, evaluated: 0 };
    entry.evaluated += 1;
    if (verdict === "EXCEEDED" || verdict === "MET") entry.success += 1;
    tally.set(ruleCode, entry);
  }

  const result: Record<string, RulePerformance> = {};
  for (const [ruleCode, { success, evaluated }] of tally) {
    result[ruleCode] = { ruleCode, sampleSize: evaluated, successRate: evaluated > 0 ? success / evaluated : null };
  }
  return result;
}
