import { categoryAggregates, departmentAggregates } from "./aggregate";
import { RISK_LEVEL_JA } from "./scoring";
import { surveyDefs } from "./surveyDefs";
import { SurveySubmission, SurveyType } from "./types";

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
}

export const SUGGESTED_PROMPTS = [
  "営業部のストレス状況を教えて",
  "腰痛リスクが高い部署はどこ?",
  "介護と仕事の両立で困っている人はいる?",
  "労働環境で改善すべき点は?",
  "生活習慣病のリスクが高い部署はどこ?",
  "全体的な健康経営の課題をまとめて",
];

/**
 * 現時点ではルールベースの簡易応答(プレースホルダー)。
 * 将来的にAIとの対話ロジックに置き換える想定のUIのみの実装。
 */
export function generateCannedReply(userText: string, submissions: SurveySubmission[]): string {
  const categories = categoryAggregates(submissions);
  const departments = departmentAggregates(submissions);
  const byType = (type: SurveyType) => categories.find((c) => c.type === type)!;

  const includesAny = (keywords: string[]) => keywords.some((k) => userText.includes(k));

  if (includesAny(["ストレス", "メンタル"])) {
    const stress = byType("stressCheck");
    const worst = [...departments].sort(
      (a, b) => (a.categoryScores.stressCheck ?? 100) - (b.categoryScores.stressCheck ?? 100)
    )[0];
    return (
      `ミニストレスチェックの全社平均は ${stress.averageScore}点(${RISK_LEVEL_JA[stress.level]}相当)で、` +
      `高ストレスと判定された回答は ${stress.highRiskCount}件あります。\n` +
      `部署別では「${worst.department}」のスコアが最も低く(${worst.categoryScores.stressCheck}点)、` +
      `直近で悪化傾向が見られます。管理職向けの1on1強化や業務量の見直しをご検討ください。`
    );
  }

  if (includesAny(["腰痛", "身体", "腰"])) {
    const backPain = byType("backPain");
    const worst = [...departments].sort(
      (a, b) => (a.categoryScores.backPain ?? 100) - (b.categoryScores.backPain ?? 100)
    )[0];
    return (
      `腰痛リスク調査の全社平均は ${backPain.averageScore}点(${RISK_LEVEL_JA[backPain.level]}相当)です。\n` +
      `特に「${worst.department}」でリスクが高く(${worst.categoryScores.backPain}点)、` +
      `移乗介助や重量物の取り扱いが多いことが要因と考えられます。福祉用具の追加導入や療法士による動作指導を提案できます。`
    );
  }

  if (includesAny(["介護", "ケアラー", "両立"])) {
    const caregiving = byType("caregiving");
    const worst = [...departments].sort(
      (a, b) => (a.categoryScores.caregiving ?? 100) - (b.categoryScores.caregiving ?? 100)
    )[0];
    return (
      `介護リスク調査の全社平均は ${caregiving.averageScore}点(${RISK_LEVEL_JA[caregiving.level]}相当)です。\n` +
      `「${worst.department}」で仕事と介護の両立に不安を抱える回答が目立ちます(${worst.categoryScores.caregiving}点)。` +
      `介護休業制度の周知や、ケアマネジャーによる個別相談会の実施が有効です。`
    );
  }

  if (includesAny(["労働環境", "エルゴノミクス", "姿勢", "作業環境"])) {
    const ergonomics = byType("ergonomics");
    return (
      `エルゴノミクス評価の全社平均は ${ergonomics.averageScore}点(${RISK_LEVEL_JA[ergonomics.level]}相当)です。\n` +
      `回答 ${ergonomics.responseCount}件のうち ${ergonomics.highRiskCount}件が要注意レベルでした。` +
      `作業台の高さ調整や補助具の導入など、療法士による現場評価をおすすめします。`
    );
  }

  if (includesAny(["生活習慣", "食事", "運動", "睡眠", "飲酒", "喫煙"])) {
    const lifestyle = byType("lifestyle");
    const worst = [...departments].sort(
      (a, b) => (a.categoryScores.lifestyle ?? 100) - (b.categoryScores.lifestyle ?? 100)
    )[0];
    return (
      `生活習慣病リスク調査の全社平均は ${lifestyle.averageScore}点(${RISK_LEVEL_JA[lifestyle.level]}相当)です。\n` +
      `「${worst.department}」で食事・運動・睡眠などの生活習慣リスクが高めです(${worst.categoryScores.lifestyle}点)。` +
      `保健師による個別指導や、生活習慣改善コースのセミナー実施をおすすめします。`
    );
  }

  if (includesAny(["まとめ", "課題", "サマリー", "全体"])) {
    const lines = categories
      .map((c) => `・${surveyDefs[c.type].shortTitle}: ${c.averageScore}点(${RISK_LEVEL_JA[c.level]}相当)`)
      .join("\n");
    return `現在の5指標の状況は以下の通りです。\n${lines}\n\n特にスコアの低い指標から優先的に対策をご提案できます。気になる指標名を送ってみてください。`;
  }

  if (includesAny(["こんにちは", "はじめまして", "よろしく"])) {
    return "こんにちは。UCHICAREの健康経営アシスタントです。ストレス・腰痛・介護・労働環境・生活習慣について、気になるテーマを教えてください。";
  }

  return (
    "ご質問ありがとうございます。現時点は簡易応答のプレースホルダーのため詳細な自由回答はできませんが、" +
    "「ストレス」「腰痛」「介護」「労働環境」「生活習慣」「まとめ」などのキーワードを含めて質問いただくと、ダッシュボードのデータをもとにお答えします。"
  );
}
