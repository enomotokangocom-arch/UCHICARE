import { ApprovalLevel } from "./types";

export const APPROVAL_LEVEL_LABEL: Record<ApprovalLevel, string> = {
  L1: "L1(可視化のみ)",
  L2: "L2(分析・提案まで)",
  L3: "L3(承認後にAIが実行)",
  L4: "L4(低リスク業務を自動実行)",
  L5: "L5(自律実行・例外のみエスカレーション)",
  human_only: "人間の最終判断が必要",
};
