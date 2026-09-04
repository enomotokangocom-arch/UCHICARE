import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CsvParseError, parseBranchMetricsCsv, parseNurseProductivityCsv } from "./csv";
import { buildDecisions, DecisionBuildResult } from "./decisionEngine";
import { enrichDecisionsWithAiNarrative } from "./explainClient";
import { CEO_TODAY, generateMockCeoDataset } from "./mockData";
import { ApprovalStatus, AuditLogEntry, CeoDataset, Decision } from "./types";

interface ApprovalOverride {
  status: ApprovalStatus;
  approvedBy: string | null;
  comment?: string;
  at: string;
}

interface NarrativeOverride {
  reasoningSummary: string;
  recommendedAction: string;
  expectedImpact: string;
}

interface CeoState {
  dataset: CeoDataset | null;
  approvals: Record<string, ApprovalOverride>;
  narrativeOverrides: Record<string, NarrativeOverride>;
  auditLog: AuditLogEntry[];
  aiStatus: "idle" | "loading" | "done" | "error";
  loadMockData: () => void;
  loadFromCsv: (branchCsvText: string, nurseCsvText: string) => { ok: boolean; error?: string };
  clearData: () => void;
  decide: (decisionId: string, status: ApprovalStatus, actor: string, comment?: string) => void;
  fetchAiNarratives: (decisions: Decision[]) => Promise<void>;
}

export const useCeoStore = create<CeoState>()(
  persist(
    (set) => ({
      dataset: null,
      approvals: {},
      narrativeOverrides: {},
      auditLog: [],
      aiStatus: "idle",

      loadMockData: () => {
        set({
          dataset: generateMockCeoDataset(),
          approvals: {},
          narrativeOverrides: {},
          auditLog: [],
          aiStatus: "idle",
        });
      },

      loadFromCsv: (branchCsvText, nurseCsvText) => {
        try {
          const branchMetrics = parseBranchMetricsCsv(branchCsvText);
          const nurseProductivity = parseNurseProductivityCsv(nurseCsvText);
          const dataset: CeoDataset = {
            branchMetrics,
            nurseProductivity,
            loadedAt: new Date().toISOString(),
            source: "csv",
          };
          set({ dataset, approvals: {}, narrativeOverrides: {}, auditLog: [], aiStatus: "idle" });
          return { ok: true };
        } catch (error) {
          const message = error instanceof CsvParseError ? error.message : "CSVの読み込みに失敗しました。";
          return { ok: false, error: message };
        }
      },

      clearData: () => set({ dataset: null, approvals: {}, narrativeOverrides: {}, auditLog: [], aiStatus: "idle" }),

      decide: (decisionId, status, actor, comment) => {
        const at = new Date().toISOString();
        set((state) => ({
          approvals: {
            ...state.approvals,
            [decisionId]: { status, approvedBy: status === "approved" ? actor : null, comment, at },
          },
          auditLog: [
            ...state.auditLog,
            {
              id: `${decisionId}-${at}`,
              decisionId,
              action: status === "approved" ? "approve" : status === "rejected" ? "reject" : "modify",
              actor,
              comment,
              at,
            },
          ],
        }));
      },

      fetchAiNarratives: async (decisions) => {
        if (decisions.length === 0) return;
        set({ aiStatus: "loading" });
        const enriched = await enrichDecisionsWithAiNarrative(decisions);
        const overrides: Record<string, NarrativeOverride> = {};
        enriched.forEach((d) => {
          if (d.aiNarrative === "generated") {
            overrides[d.decisionId] = {
              reasoningSummary: d.reasoningSummary,
              recommendedAction: d.recommendedAction,
              expectedImpact: d.expectedImpact,
            };
          }
        });
        set((state) => ({
          narrativeOverrides: { ...state.narrativeOverrides, ...overrides },
          aiStatus: Object.keys(overrides).length > 0 ? "done" : "error",
        }));
      },
    }),
    {
      name: "uchicare-ceo-data",
      skipHydration: true,
      partialize: (state) => ({
        dataset: state.dataset,
        approvals: state.approvals,
        narrativeOverrides: state.narrativeOverrides,
        auditLog: state.auditLog,
      }),
    }
  )
);

/** dataset + 承認状態 + AI説明文の上書きを合成し、最新のDecision一覧を導出する。 */
export function deriveCeoDecisions(state: Pick<CeoState, "dataset" | "approvals" | "narrativeOverrides">): DecisionBuildResult {
  if (!state.dataset) return { topDecisions: [], watchList: [], okDecisions: [], allDecisions: [] };

  const applyOverrides = (d: Decision): Decision => {
    const approval = state.approvals[d.decisionId];
    const narrative = state.narrativeOverrides[d.decisionId];
    return {
      ...d,
      ...(approval
        ? { approvalStatus: approval.status, approvedBy: approval.approvedBy, updatedAt: approval.at }
        : {}),
      ...(narrative ? { ...narrative, aiNarrative: "generated" as const } : {}),
    };
  };

  const result = buildDecisions(state.dataset, CEO_TODAY);
  return {
    topDecisions: result.topDecisions.map(applyOverrides),
    watchList: result.watchList.map(applyOverrides),
    okDecisions: result.okDecisions.map(applyOverrides),
    allDecisions: result.allDecisions.map(applyOverrides),
  };
}
