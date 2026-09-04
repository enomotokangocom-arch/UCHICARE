import { CEO_CONFIG } from "./config";
import { Decision, DecisionType, Severity } from "./types";

export function slug(...parts: string[]): string {
  return parts.join(":");
}

export function severityRank(s: Severity): number {
  return s === "red" ? 2 : s === "yellow" ? 1 : 0;
}

export function approvalLevelFor(type: DecisionType): Decision["requiredApprovalLevel"] {
  return (CEO_CONFIG.approvalLevel[type] as Decision["requiredApprovalLevel"]) ?? "L2";
}

/** PriorityScore = FinancialImpact × Urgency × Probability × Irreversibility(03-decision-engine.md) */
export function priorityScore(args: {
  gap: number;
  reference: number;
  severity: Severity;
  probability: number;
  decisionType: DecisionType;
}): number {
  const financialImpact = Math.min(1, Math.abs(args.gap) / (Math.abs(args.reference) || 1));
  const urgency = args.severity === "red" ? 1 : args.severity === "yellow" ? 0.6 : 0.2;
  const irreversibility = CEO_CONFIG.priority.irreversibility[args.decisionType] ?? 0.5;
  return Math.round(financialImpact * urgency * Math.max(0.05, args.probability) * irreversibility * 100);
}

export function baseDecision(
  now: string,
  decisionType: DecisionType,
  entityType: Decision["entityType"],
  entityId: string,
  entityLabel: string
): Pick<
  Decision,
  | "decisionId"
  | "decisionType"
  | "entityType"
  | "entityId"
  | "entityLabel"
  | "detectedAt"
  | "createdAt"
  | "updatedAt"
  | "approvalStatus"
  | "approvedBy"
  | "executionStatus"
  | "result"
  | "aiNarrative"
> {
  return {
    decisionId: slug(decisionType, entityId, now.slice(0, 7)),
    decisionType,
    entityType,
    entityId,
    entityLabel,
    detectedAt: now,
    createdAt: now,
    updatedAt: now,
    approvalStatus: "pending",
    approvedBy: null,
    executionStatus: "n/a",
    result: null,
    aiNarrative: "pending",
  };
}

export function yen(n: number): string {
  return `${Math.round(n).toLocaleString()}円`;
}
