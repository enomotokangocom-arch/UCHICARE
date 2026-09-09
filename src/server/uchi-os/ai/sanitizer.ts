// Data Sanitizer (08.4節) — LLMへ送信する直前のペイロードから個人識別情報を除去する共通関数。
// AI Reasoning Layer は必ずこの関数を経由したデータのみをプロンプトに含める。

/**
 * テキスト中に含まれる職員氏名を匿名トークン(職員A, 職員B, ...)に置換する。
 * DR-07(過稼働)のrootCauseラベルのように、個人名がDecisionの文言に埋め込まれるケースへの対応。
 * 表示用のDB上のデータ自体は変更しない — LLMへ渡すプロンプト構築時にのみ適用する。
 */
export function redactEmployeeNames(text: string, employeeNames: string[]): string {
  let result = text;
  const uniqueNames = [...new Set(employeeNames)].filter((name) => name.length > 0);
  // 長い名前から置換することで、部分文字列の衝突(例: "田中"が"田中太郎"の一部)を避ける。
  uniqueNames.sort((a, b) => b.length - a.length);
  uniqueNames.forEach((name, index) => {
    const token = `職員${String.fromCharCode(65 + (index % 26))}`;
    result = result.split(name).join(token);
  });
  return result;
}

export interface SanitizedFactor {
  label: string;
  value: number | null;
}

export interface SanitizedDecision {
  ruleCode: string;
  priority: string;
  stationName: string;
  problemSummary: string;
  factors: SanitizedFactor[];
  predictedImpact: number | null;
  confidence: number;
}

/** Decision + 関連employeeNamesから、LLMへ送る安全な構造化サマリーを作る。 */
export function sanitizeDecisionForPrompt(
  decision: {
    ruleCode: string;
    priority: string;
    problemSummary: string;
    rootCause: unknown;
    predictedImpact: unknown;
    confidence: number;
  },
  stationName: string,
  employeeNames: string[],
): SanitizedDecision {
  const rootCause = decision.rootCause as { factors?: { label: string; value: number | null }[] } | null;
  const factors = (rootCause?.factors ?? []).map((f) => ({
    label: redactEmployeeNames(f.label, employeeNames),
    value: f.value,
  }));

  return {
    ruleCode: decision.ruleCode,
    priority: decision.priority,
    stationName,
    problemSummary: redactEmployeeNames(decision.problemSummary, employeeNames),
    factors,
    predictedImpact: decision.predictedImpact != null ? Number(decision.predictedImpact) : null,
    confidence: decision.confidence,
  };
}
