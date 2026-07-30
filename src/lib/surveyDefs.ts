import { SurveyDef, SurveyType } from "./types";

const scaleLabels: [string, string, string, string] = [
  "あてはまらない",
  "あまりあてはまらない",
  "ややあてはまる",
  "あてはまる",
];

export const surveyDefs: Record<SurveyType, SurveyDef> = {
  ergonomics: {
    type: "ergonomics",
    title: "エルゴノミクス評価(労働環境)",
    shortTitle: "エルゴノミクス評価",
    description:
      "作業姿勢・設備・環境が身体に負担をかけない設計になっているかを、療法士監修の視点でチェックします。",
    icon: "🪑",
    accentColor: "#2563eb",
    scaleLabels,
    questions: [
      { id: "erg1", text: "椅子や机の高さは、使う人の体格に合っている", polarity: "positive" },
      { id: "erg2", text: "モニターや書類の位置は、目線の高さに近く無理な首の角度にならない", polarity: "positive" },
      { id: "erg3", text: "頻繁に使う物品は、無理なく手が届く範囲に配置されている", polarity: "positive" },
      { id: "erg4", text: "同一姿勢が長時間(1時間以上)続かないよう、作業の工夫がされている", polarity: "positive" },
      { id: "erg5", text: "作業に十分な明るさ・換気・室温が確保されている", polarity: "positive" },
      { id: "erg6", text: "重量物を扱う際に台車・リフトなどの補助具が使える環境である", polarity: "positive" },
      { id: "erg7", text: "床は滑りにくく、つまずく障害物がない", polarity: "positive" },
      { id: "erg8", text: "作業姿勢や身体の使い方について、会社から指導や情報提供を受けている", polarity: "positive" },
    ],
    resultLabels: {
      low: "良好",
      medium: "要改善",
      high: "要注意",
    },
    resultAdvice: {
      low: "現在の作業環境は概ね良好です。定期的な見直しで水準を維持しましょう。",
      medium: "一部に負担のかかる作業環境があります。療法士による作業現場の個別評価をおすすめします。",
      high: "身体への負担が大きい作業環境の可能性があります。早めのエルゴノミクス改善(什器・動線・補助具導入)をご検討ください。",
    },
  },
  stressCheck: {
    type: "stressCheck",
    title: "ミニストレスチェック",
    shortTitle: "ミニストレスチェック",
    description:
      "職業性ストレス簡易調査票の考え方をもとにした簡易版アンケートです。仕事の負担・心身の反応・周囲のサポートの3領域を測定します。※法定の57項目版に代わるものではありません。",
    icon: "🧠",
    accentColor: "#7c3aed",
    scaleLabels: ["ほとんどない", "時々ある", "しばしばある", "ほとんどいつも"],
    questions: [
      { id: "st1", text: "非常にたくさんの仕事を抱えていると感じる", polarity: "negative" },
      { id: "st2", text: "時間内に仕事を処理しきれないと感じる", polarity: "negative" },
      { id: "st3", text: "自分のペースで仕事を進められないと感じる", polarity: "negative" },
      { id: "st4", text: "イライラすることがある", polarity: "negative" },
      { id: "st5", text: "ひどく疲れたと感じる", polarity: "negative" },
      { id: "st6", text: "気分が沈む・憂うつだと感じる", polarity: "negative" },
      { id: "st7", text: "上司に相談したり、支援を受けたりしやすい", polarity: "positive" },
      { id: "st8", text: "同僚に相談したり、支援を受けたりしやすい", polarity: "positive" },
      { id: "st9", text: "家族や友人に悩みを聞いてもらえる", polarity: "positive" },
    ],
    resultLabels: {
      low: "低ストレス",
      medium: "中ストレス",
      high: "高ストレス",
    },
    resultAdvice: {
      low: "ストレス反応は低い水準です。良い状態を保てるようセルフケアを継続しましょう。",
      medium: "ストレスがやや高まっています。業務量や相談環境を見直すタイミングかもしれません。",
      high: "高ストレス状態の可能性があります。保健師・産業医への早めの相談をおすすめします。",
    },
  },
  backPain: {
    type: "backPain",
    title: "腰痛リスク調査",
    shortTitle: "腰痛リスク調査",
    description:
      "介助・重量物の取り扱いなど、腰への負担が大きい業務に従事する方の腰痛リスクをチェックします。",
    icon: "🦴",
    accentColor: "#ea580c",
    scaleLabels,
    questions: [
      { id: "bp1", text: "中腰や前かがみの姿勢での作業が多い", polarity: "negative" },
      { id: "bp2", text: "利用者や重量物を一人で持ち上げる・移乗させることがある", polarity: "negative" },
      { id: "bp3", text: "同じ動作の繰り返しで腰に負担を感じる", polarity: "negative" },
      { id: "bp4", text: "現在、腰痛や腰の違和感がある", polarity: "negative" },
      { id: "bp5", text: "ぎっくり腰になりかけた等のヒヤリハットを経験したことがある", polarity: "negative" },
      { id: "bp6", text: "移乗介助の際にリフトやスライディングボードなどの福祉用具を使っている", polarity: "positive" },
      { id: "bp7", text: "腰痛予防に関する研修や指導を受けたことがある", polarity: "positive" },
      { id: "bp8", text: "業務中に腰を伸ばす・休憩を取る時間がある", polarity: "positive" },
    ],
    resultLabels: {
      low: "低リスク",
      medium: "中リスク",
      high: "高リスク",
    },
    resultAdvice: {
      low: "腰痛リスクは低い水準です。予防の取り組みを継続しましょう。",
      medium: "腰痛リスクがやや高まっています。福祉用具の活用や作業姿勢の見直しをおすすめします。",
      high: "腰痛リスクが高い状態です。療法士による動作指導・福祉用具導入など早急な対策をおすすめします。",
    },
  },
  caregiving: {
    type: "caregiving",
    title: "介護リスク調査(ビジネスケアラー)",
    shortTitle: "介護リスク調査",
    description:
      "家族の介護と仕事の両立状況から、介護離職につながるリスクをケアマネジャーの視点でチェックします。",
    icon: "🤝",
    accentColor: "#0d9488",
    scaleLabels,
    questions: [
      { id: "cg1", text: "現在、家族の介護をしている", polarity: "negative" },
      { id: "cg2", text: "介護と仕事の両立に不安を感じる", polarity: "negative" },
      { id: "cg3", text: "介護のために仕事を休んだり早退したりすることがある", polarity: "negative" },
      { id: "cg4", text: "今後5年以内に介護が必要になりそうな家族がいる", polarity: "negative" },
      { id: "cg5", text: "介護について身近に相談できる相手がいない", polarity: "negative" },
      { id: "cg6", text: "会社の介護休業・介護休暇制度の内容を知っている", polarity: "positive" },
      { id: "cg7", text: "上司や人事に介護の状況を相談しやすい雰囲気がある", polarity: "positive" },
      { id: "cg8", text: "ケアマネジャー等、介護の専門家に相談できる状態である", polarity: "positive" },
    ],
    resultLabels: {
      low: "低リスク",
      medium: "中リスク",
      high: "高リスク",
    },
    resultAdvice: {
      low: "介護離職につながるリスクは低い水準です。制度の周知を継続しましょう。",
      medium: "介護との両立に負担が出始めています。制度案内やケアマネへの相談機会の提供をおすすめします。",
      high: "介護離職につながる高いリスクがあります。個別面談やケアマネジャーとの連携を早急にご検討ください。",
    },
  },
};

export const surveyList = Object.values(surveyDefs);
