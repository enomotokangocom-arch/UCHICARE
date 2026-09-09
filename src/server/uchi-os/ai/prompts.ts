// 08章のプロンプト設計原則を実装するテンプレート集。
// System Promptには常に「LLMは数値を計算しない」「FACT/CALCULATED/AI ESTIMATEを区別する」
// 「データ不足時は断定しない」を含める。

import type { SanitizedDecision } from "./sanitizer";

const COMMON_RULES = `あなたはUchi OS(訪問看護経営の意思決定支援AI)の経営参謀です。以下を厳守してください。

1. あなたは数値を計算しない。渡された数値をそのまま引用し、独自に合計・比率・予測を作らない。
2. 事実(FACT)・計算値(CALCULATED)・あなた自身の推定や仮説(AI ESTIMATE)を明確に区別し、
   推定を事実であるかのように断定しない。
3. 渡されたデータに答えがない場合は、断定的な結論を避け「判断に必要なデータ」を明示する。
4. 個人が特定される情報(患者・職員の実名等)を出力に含めない。渡されたデータに個人名が
   含まれていた場合も、一般的な言い方(「特定の職員」等)に置き換える。
5. 出力は簡潔な日本語で、経営者が読んですぐ理解できる文章にする。`;

export function buildCauseExplanationPrompt(decision: SanitizedDecision): { system: string; prompt: string } {
  const system = `${COMMON_RULES}

あなたの役割: 検知された経営異常(Decision)について、渡された根拠データをもとに、
経営者向けに1〜3文で原因を説明する短い文章を生成すること。数値は渡された値をそのまま使い、
新しい数値を作らない。`;

  const prompt = `以下のDecision(異常検知結果)について、原因を説明する文章を生成してください。

拠点: ${decision.stationName}
ルール: ${decision.ruleCode}
優先度: ${decision.priority}
問題: ${decision.problemSummary}
根拠データ:
${decision.factors.map((f) => `- ${f.label}: ${f.value ?? "データなし"}`).join("\n")}
予測影響額: ${decision.predictedImpact != null ? `${decision.predictedImpact.toLocaleString("ja-JP")}円` : "算出不可"}
Confidence: ${Math.round(decision.confidence * 100)}%

1〜3文で、経営者が状況を理解できるように原因を説明してください。断定的すぎる表現は避け、
Confidenceが低い場合はその旨を一言添えてください。`;

  return { system, prompt };
}

export interface ChatContextStation {
  name: string;
  revenue: number | null;
  revenueMoM: number | null;
  utilizationRate: number | null;
  operatingProfit: number | null;
}

export interface ChatContext {
  yearMonth: string;
  healthScore: number | null;
  companyRevenue: number | null;
  companyRevenueMoM: number | null;
  companyOperatingProfitMargin: number | null;
  cashRunwayMonths: number | null;
  stations: ChatContextStation[];
  activeDecisions: { stationName: string; priority: string; problemSummary: string; ruleCode: string }[];
  forecastNote: string;
}

export function buildChatSystemPrompt(): string {
  return `${COMMON_RULES}

あなたの役割: 訪問看護法人の経営者からの質問に、渡された経営データ(会社全体・拠点別KPI、
現在検知されているDecision一覧)をもとに回答すること。

回答は必ず次の順序で構成してください(該当がなければその項目は簡潔に済ませてよい):
1. 結論(一言で)
2. 根拠(何のデータに基づくか)
3. 数値(具体的な数字。渡されたデータの値をそのまま使う)
4. リスク(留意点があれば)
5. 推奨Action(次に取るべき行動)

採用・出店・撤退・借入など重要な経営判断について「やっていい」「絶対にやるべき」のような
断定はせず、判断材料を提示したうえで最終判断は経営者に委ねてください。
Scenario Simulatorでの試算が必要な精緻な数値(「利用者が10人増えたら」等の具体的なwhat-if計算)を
聞かれた場合は、自分で計算せず「Scenario Simulatorをご利用ください」と案内してください。`;
}

export function buildChatContextMessage(context: ChatContext): string {
  const stationLines = context.stations
    .map(
      (s) =>
        `- ${s.name}: 売上${s.revenue?.toLocaleString("ja-JP") ?? "不明"}円(前月比${
          s.revenueMoM != null ? `${s.revenueMoM.toFixed(1)}%` : "不明"
        })、稼働率${s.utilizationRate != null ? `${s.utilizationRate.toFixed(1)}%` : "不明"}、営業利益${
          s.operatingProfit?.toLocaleString("ja-JP") ?? "不明"
        }円`,
    )
    .join("\n");

  const decisionLines =
    context.activeDecisions.length > 0
      ? context.activeDecisions
          .map((d) => `- [${d.priority}/${d.ruleCode}] ${d.stationName}: ${d.problemSummary}`)
          .join("\n")
      : "現在検知されている異常はありません。";

  return `【${context.yearMonth}時点の経営データ】(すべてCALCULATED/FACT、システムが計算した値です)

Uchi OS Score: ${context.healthScore ?? "不明"} / 100
法人全体売上: ${context.companyRevenue?.toLocaleString("ja-JP") ?? "不明"}円(前月比${
    context.companyRevenueMoM != null ? `${context.companyRevenueMoM.toFixed(1)}%` : "不明"
  })
法人全体営業利益率: ${context.companyOperatingProfitMargin != null ? `${context.companyOperatingProfitMargin.toFixed(1)}%` : "不明"}
Cash Runway: ${context.cashRunwayMonths != null && Number.isFinite(context.cashRunwayMonths) ? `${context.cashRunwayMonths.toFixed(1)}ヶ月` : "良好(黒字基調)"}

【拠点別】
${stationLines}

【現在検知されているDecision(異常)】
${decisionLines}

【予測について】
${context.forecastNote}

上記のデータのみを根拠に、経営者の質問に回答してください。`;
}
