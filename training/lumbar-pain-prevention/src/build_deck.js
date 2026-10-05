// 株式会社Uchi care 職員研修
// 「訪問看護・居宅介護支援における腰痛予防研修」スライド生成スクリプト
// 実行: NODE_PATH=<pptxgenjsのnode_modules> node build_deck.js <出力先.pptx> [apply_theme.jsのパス]
"use strict";
const pptxgen = require("pptxgenjs");

const OUT = process.argv[2] || "uchicare_lumbar_training.pptx";
const APPLY_THEME = process.argv[3];

const THEME = {
  name: "Uchi care Home Care",
  headFontFace: "BIZ UDPGothic",
  bodyFontFace: "BIZ UDPGothic",
  colors: {
    dk1: "1B2F3E", // 深いネイビー（本文）
    lt1: "FFFFFF",
    dk2: "0E5A5F", // 深い青緑（見出し・強調）
    lt2: "F4F8F8", // オフホワイト
    accent1: "2A8C82", // 青緑
    accent2: "3F7FAE", // 落ち着いた青
    accent3: "D9F0EA", // 淡いミント
    accent4: "E1EEF7", // 淡い水色
    accent5: "C46A1F", // 注意用オレンジ
    accent6: "6A7B87", // グレー
    hlink: "2A6F9E",
    folHlink: "5B6F7E",
  },
};
const HEX = THEME.colors;
const ORANGE_BG = "FBEEE2";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.title = "訪問看護・居宅介護支援における腰痛予防研修";
pres.author = "株式会社Uchi care";
pres.company = "株式会社Uchi care";
pres.subject = "職員の健康保持・増進と業務に伴う腰痛の予防";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const S = pres.shapes;

const FOOTER = "株式会社Uchi care　訪問看護・居宅介護支援における腰痛予防研修";

// ---------- レイアウト ----------
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: HEX.lt1 },
  margin: [0.5, 0.6, 0.6, 0.6],
  objects: [
    { text: { text: FOOTER, options: { x: 0.6, y: 7.05, w: 8, h: 0.3, fontSize: 10, color: C.accent6, margin: 0 } } },
    {
      placeholder: {
        options: { name: "tag", type: "body", x: 0.6, y: 0.28, w: 8, h: 0.34, fontSize: 13, bold: true, color: C.accent1, margin: 0, valign: "middle" },
        text: "",
      },
    },
    {
      placeholder: {
        options: { name: "title", type: "title", x: 0.6, y: 0.62, w: 12.1, h: 0.78, fontSize: 28, bold: true, color: C.text1, margin: 0, valign: "middle", align: "left" },
        text: "",
      },
    },
  ],
  slideNumber: { x: 12.1, y: 7.05, w: 0.6, h: 0.3, fontSize: 10, color: C.accent6, align: "right" },
});

pres.defineSlideMaster({
  title: "COVER",
  background: { color: HEX.lt1 },
  objects: [],
});

// ---------- 共通ヘルパー ----------
function slideWith(section, tag, title) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(tag, { placeholder: "tag" });
  s.addText(title, { placeholder: "title" });
  return s;
}

function source(s, text) {
  s.addText("出典：" + text, {
    x: 0.6, y: 6.6, w: 12.1, h: 0.36, fontSize: 10.5, color: C.accent6, margin: 0, valign: "top", isTextBox: true, objectName: "source",
  });
}

// 箇条書き配列 → pptxgenjs runs
function bullets(items, opt = {}) {
  const size = opt.fontSize || 16;
  return items.map((it, i) => {
    const o = typeof it === "string" ? { text: it } : it;
    const last = i === items.length - 1;
    return {
      text: o.text,
      options: {
        bullet: o.noBullet ? false : o.sub ? { indent: 18 } : { indent: 16 },
        indentLevel: o.sub ? 1 : 0,
        fontSize: o.sub ? size - 1.5 : size,
        bold: !!o.bold,
        color: o.color || C.text1,
        paraSpaceAfter: opt.space != null ? opt.space : 5,
        breakLine: !last,
      },
    };
  });
}

function box(s, x, y, w, h, fill, name, lineColor) {
  s.addShape(S.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: lineColor ? { color: lineColor, width: 1 } : { type: "none" }, objectName: name,
  });
}

function label(s, text, x, y, w, h, opt = {}) {
  s.addText(text, Object.assign({ x, y, w, h, fontSize: 14, color: C.text1, margin: 0, valign: "middle", isTextBox: true }, opt));
}

function arrow(s, x1, y1, x2, y2, color, width = 1.5, name) {
  const flipH = x2 < x1;
  const flipV = y2 < y1;
  s.addShape(S.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.max(Math.abs(x2 - x1), 0.001), h: Math.max(Math.abs(y2 - y1), 0.001),
    flipH, flipV, line: { color, width, endArrowType: "triangle" }, objectName: name,
  });
}

function line(s, x1, y1, x2, y2, color, width = 1, dash) {
  const flipH = x2 < x1;
  const flipV = y2 < y1;
  s.addShape(S.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.max(Math.abs(x2 - x1), 0.001), h: Math.max(Math.abs(y2 - y1), 0.001),
    flipH, flipV, line: { color, width, dashType: dash || "solid" },
  });
}

// 表のセル
const TH = (t, o = {}) => ({ text: t, options: Object.assign({ bold: true, color: HEX.lt1, fill: { color: HEX.dk2 }, fontSize: 14, valign: "middle" }, o) });
const TL = (t, o = {}) => ({ text: t, options: Object.assign({ bold: true, color: HEX.dk2, fill: { color: HEX.accent3 }, fontSize: 14, valign: "middle" }, o) });
const TD = (t, o = {}) => ({ text: t, options: Object.assign({ color: HEX.dk1, fontSize: 13.5, valign: "top" }, o) });
// 区切り文字で分けて箇条書きのセルにする
function TDL(str, sep, size = 14) {
  const items = str.split(sep).map((t) => t.trim()).filter(Boolean);
  return {
    text: items.map((t, i) => ({
      text: t + (sep === "。" ? "。" : ""),
      options: { bullet: { indent: 12 }, breakLine: i < items.length - 1, paraSpaceAfter: 3 },
    })),
    options: { color: HEX.dk1, fontSize: size, valign: "top" },
  };
}
const TABLE_BASE = { border: { type: "solid", pt: 0.75, color: "C9D8DA" }, margin: [0.06, 0.1, 0.06, 0.1], fontFace: THEME.bodyFontFace };

// =========================================================
// 1. 表紙
// =========================================================
pres.addSection({ title: "導入" });
{
  const s = pres.addSlide({ masterName: "COVER", sectionTitle: "導入" });
  s.addShape(S.RECTANGLE, { x: 8.55, y: 0, w: 4.783, h: 7.5, fill: { color: HEX.accent3 }, line: { type: "none" }, objectName: "cover-panel" });
  // 右パネル：本研修で扱う視点（文章の代わりに3つの軸を図示）
  const axes = [
    ["なぜ", "負担が生じる仕組み"],
    ["何を", "評価するか"],
    ["どの根拠で", "方法・用具を選ぶか"],
  ];
  axes.forEach((a, i) => {
    const y = 1.75 + i * 1.45;
    s.addShape(S.OVAL, { x: 9.2, y, w: 1.05, h: 1.05, fill: { color: HEX.lt1 }, line: { color: HEX.accent1, width: 1.5 }, objectName: "cover-axis-" + i });
    label(s, String(i + 1), 9.2, y, 1.05, 1.05, { align: "center", fontSize: 26, bold: true, color: C.accent1 });
    label(s, a[0], 10.45, y + 0.05, 2.6, 0.45, { fontSize: 18, bold: true, color: C.text2 });
    label(s, a[1], 10.45, y + 0.5, 2.6, 0.45, { fontSize: 16, color: C.text1 });
  });
  label(s, "株式会社Uchi care　職員研修", 0.8, 0.8, 7.4, 0.45, { fontSize: 16, bold: true, color: C.accent1 });
  s.addText("訪問看護・居宅介護支援における\n腰痛予防研修", {
    x: 0.8, y: 1.55, w: 7.5, h: 1.9, fontSize: 36, bold: true, color: C.text1, margin: 0, valign: "top", isTextBox: true, paraSpaceAfter: 4, objectName: "cover-title",
  });
  label(s, "作業条件の評価と、方法を選ぶ根拠を学ぶ", 0.8, 3.55, 7.4, 0.5, { fontSize: 20, color: C.text2 });
  s.addTable(
    [
      [TD("対象", { bold: true, color: HEX.dk2, fontSize: 14 }), TD("看護師・理学療法士・作業療法士・ケアマネジャー・事務職", { fontSize: 14 })],
      [TD("目的", { bold: true, color: HEX.dk2, fontSize: 14 }), TD("職員自身の健康保持・増進と、業務に伴う腰痛の予防", { fontSize: 14 })],
      [TD("時間", { bold: true, color: HEX.dk2, fontSize: 14 }), TD("30〜40分（講義・事例検討・理解度確認）", { fontSize: 14 })],
    ],
    { x: 0.8, y: 4.45, w: 7.3, colW: [1.0, 6.3], border: { type: "none" }, margin: [0.05, 0.05, 0.05, 0], fontFace: THEME.bodyFontFace }
  );
  label(s, "本資料は一般的な予防教育です。個別の診断・治療・就業判断は医師等にご相談ください。", 0.8, 6.55, 7.5, 0.4, { fontSize: 11, color: C.accent6 });
  s.addNotes(
    [
      "【この研修のねらい】",
      "「姿勢に気をつけましょう」で終わらせず、①なぜ腰部に負担が生じるのか、②何を評価するのか、③どの根拠で作業方法・福祉用具・作業環境を選ぶのか、を専門職として説明できることを目指します。",
      "",
      "【位置づけ】",
      "・厚生労働省「職場における腰痛予防対策指針」（2013年改訂）は、介護・看護作業に従事する労働者への労働衛生教育（配置時およびその後必要に応じて）を示しています。本研修はその考え方に沿った社内教育です。",
      "・健康経営優良法人認定に向けた社内の健康保持・増進の取組の一つとして実施します。ただし、本研修の実施だけで認定が得られるものではなく、また腰痛研修がすべての法人に一律に義務づけられているわけでもありません。",
      "",
      "【進め方（目安）】導入3分／基礎5分／バイオメカニクス5分／場面別リスク7分／用具3分／居宅介護支援4分／慢性化・受診目安4分／事例検討6分／理解度確認・整理3分",
      "",
      "【注意】本資料は一般的な予防教育であり、個別の診断・治療・就業可否の判断を代替しません。用具の操作は各製品の取扱説明書と実技指導で習得してください。",
      "",
      "出典：厚生労働省「職場における腰痛予防対策指針」（2013）；経済産業省「健康経営優良法人認定制度」",
    ].join("\n")
  );
}

// =========================================================
// 2. 研修の位置づけと学習目標
// =========================================================
{
  const s = slideWith("導入", "導入", "なぜ今、腰痛予防を「判断の根拠」から学ぶのか");
  // 左：背景データ
  box(s, 0.6, 1.6, 5.6, 4.85, HEX.lt2, "bg-left");
  label(s, "職場の腰痛の現状（国内）", 0.85, 1.75, 5.2, 0.4, { fontSize: 16, bold: true, color: C.text2 });
  label(s, "約6割", 0.85, 2.25, 2.3, 0.85, { fontSize: 40, bold: true, color: C.accent1 });
  label(s, "休業4日以上の業務上疾病に\n占める業務上腰痛の割合", 3.1, 2.25, 3.0, 0.85, { fontSize: 14 });
  label(s, "最多", 0.85, 3.2, 2.3, 0.85, { fontSize: 40, bold: true, color: C.accent1 });
  label(s, "業種別の業務上腰痛件数で\n保健衛生業が最も多い", 3.1, 3.2, 3.0, 0.85, { fontSize: 14 });
  s.addText(
    bullets(
      [
        "2018〜2019年の労働者死傷病報告の分析。休業3日以下や未報告の腰痛は含まれない",
        "施設・病院のデータが中心で、訪問看護にそのまま当てはめることはできない",
      ],
      { fontSize: 13, space: 3 }
    ),
    { x: 0.85, y: 4.2, w: 5.2, h: 2.1, valign: "top", margin: 0, isTextBox: true }
  );
  // 右：学習目標
  label(s, "この研修で説明できるようになること", 6.6, 1.6, 6.1, 0.4, { fontSize: 16, bold: true, color: C.text2 });
  const goals = [
    ["1", "腰痛の構造的・心理社会的な成り立ちと、画像所見の解釈の限界"],
    ["2", "荷重・距離・時間・頻度・支持から腰部負担を評価する方法"],
    ["3", "場面ごとの評価項目と、方法・福祉用具を選ぶ根拠と限界"],
    ["4", "慢性化に関わる要因と、受診・医療相談が必要なサイン"],
  ];
  goals.forEach((g, i) => {
    const y = 2.15 + i * 0.82;
    s.addShape(S.OVAL, { x: 6.6, y: y + 0.08, w: 0.5, h: 0.5, fill: { color: HEX.accent1 }, line: { type: "none" }, objectName: "goal-" + i });
    label(s, g[0], 6.6, y + 0.08, 0.5, 0.5, { align: "center", fontSize: 16, bold: true, color: C.background1 });
    label(s, g[1], 7.3, y, 5.4, 0.66, { fontSize: 15.5 });
  });
  box(s, 6.6, 5.5, 6.1, 0.95, HEX.accent4, "note-kenko");
  label(s, "健康経営の取組の一つとして実施します。本研修のみで認定されるものではなく、作業環境・体制の改善と組み合わせて効果を考えます。", 6.8, 5.55, 5.75, 0.85, { fontSize: 13 });
  source(s, "岩切一幸ほか. 産業衛生学雑誌 2022;64(6):354-366／厚生労働省「職場における腰痛予防対策指針」(2013)／経済産業省「健康経営優良法人認定制度」");
  s.addNotes(
    [
      "【補足説明】",
      "・岩切ら（2022）は2018〜2019年の労働者死傷病報告（休業4日以上）を分析し、業務上腰痛が業務上疾病の約6割を占めること、業種大分類では保健衛生業が最も多いこと（社会福祉施設が大きな割合）を報告しています。",
      "・この数字は「休業4日以上で報告された腰痛」に限られます。短期の休業や我慢しながら働いている腰痛（プレゼンティーイズム）は含まれないため、実態はより大きい可能性があります。",
      "",
      "【判断の根拠・一般化の注意】",
      "・統計の多くは施設介護・病院のデータです。訪問看護・居宅介護支援は、作業環境を事業者が直接整えにくい（利用者宅が職場）、単独訪問が多い、移動・運転が多いなどの違いがあり、同じリスク構造とは限りません。",
      "・腰痛予防対策指針は、作業管理・作業環境管理・健康管理・労働衛生教育を総合的に進めることを求めています。教育（本研修）単独での効果には限界があることを前提に聞いてください（後半の運動・教育の根拠のスライドで再確認します）。",
      "",
      "【学習目標と指針の教育項目の対応】",
      "指針の労働衛生教育4項目（①腰痛の発生状況及び原因、②発生要因の特定及びリスクの見積り方法、③発生要因の低減措置、④腰痛予防体操）に対し、本研修は①＝基礎、②＝バイオメカニクス・評価項目、③＝場面別対策・用具・エルゴノミクス、④＝運動の位置づけ、で対応します。",
      "",
      "出典：岩切一幸, 佐々木毅, 三木圭一. 2018年及び2019年労働者死傷病報告における業務上腰痛の発生状況. 産業衛生学雑誌 2022;64(6):354-366. doi:10.1539/sangyoeisei.2021-038-E／厚生労働省「職場における腰痛予防対策指針」(2013)／経済産業省「健康経営優良法人認定制度」",
    ].join("\n")
  );
}

// =========================================================
// 3. 腰部の構造
// =========================================================
pres.addSection({ title: "1 腰痛を理解するための基礎" });
{
  const s = slideWith("1 腰痛を理解するための基礎", "1　腰痛を理解するための基礎", "腰部を支える構造と、それぞれの役割");
  // 概念図：腰椎側面（左＝前方、右＝後方）
  box(s, 0.6, 1.55, 6.3, 4.95, HEX.lt2, "fig-bg");
  label(s, "腰椎の側面（概念図：左が前、右が後ろ）", 0.8, 1.62, 5.9, 0.35, { fontSize: 12, color: C.accent6 });
  const off = [0.22, 0.08, 0.0, 0.08, 0.24]; // 前弯を表す前後方向のずれ
  const bx = 1.75, bw = 1.25, bh = 0.6, dh = 0.2, top = 2.1;
  const VERT = "C9D3D9";
  for (let i = 0; i < 5; i++) {
    const y = top + i * (bh + dh);
    const x = bx + off[i];
    // 椎体
    s.addShape(S.ROUNDED_RECTANGLE, { x, y, w: bw, h: bh, rectRadius: 0.1, fill: { color: VERT }, line: { color: "8FA1AC", width: 0.75 }, objectName: "body-L" + (i + 1) });
    label(s, "L" + (i + 1), x, y, bw, bh, { align: "center", fontSize: 12, color: C.accent6 });
    // 椎弓（椎弓根〜椎弓板）：椎体の後上部から後方へ
    s.addShape(S.RECTANGLE, { x: x + bw - 0.05, y: y + 0.04, w: 0.75, h: 0.3, fill: { color: VERT }, line: { color: "8FA1AC", width: 0.75 }, objectName: "arch-" + (i + 1) });
    // 棘突起（椎弓から後下方へ連続）
    s.addShape(S.ROUNDED_RECTANGLE, { x: x + bw + 0.6, y: y + 0.12, w: 0.85, h: 0.32, rectRadius: 0.06, fill: { color: VERT }, line: { color: "8FA1AC", width: 0.75 }, objectName: "spinous-" + (i + 1) });
    if (i < 4) {
      // 椎間板
      const nx = bx + (off[i] + off[i + 1]) / 2;
      s.addShape(S.ROUNDED_RECTANGLE, { x: nx + 0.04, y: y + bh, w: bw - 0.08, h: dh, rectRadius: 0.08, fill: { color: "9CC9E3" }, line: { color: "5E9CC0", width: 0.5 }, objectName: "disc-" + (i + 1) });
      // 神経根：椎間孔（椎間板の後方・上下の椎弓の間）から前下方へ
      s.addShape(S.OVAL, { x: nx + bw + 0.02, y: y + bh - 0.1, w: 0.2, h: 0.24, fill: { color: "E9B949" }, line: { type: "none" }, objectName: "root-" + (i + 1) });
      line(s, nx + bw + 0.08, y + bh + 0.12, nx + bw - 0.25, y + bh + 0.5, "D9A21B", 2.25);
      // 椎間関節：椎間孔の後方で上下の椎弓が接する部分
      s.addShape(S.OVAL, { x: nx + bw + 0.38, y: y + bh - 0.17, w: 0.3, h: 0.3, fill: { color: HEX.lt1 }, line: { color: HEX.accent2, width: 1.75 }, objectName: "facet-" + (i + 1) });
    }
  }
  // 脊柱起立筋群（後方）
  s.addShape(S.ROUNDED_RECTANGLE, { x: 4.85, y: 2.0, w: 0.55, h: 3.95, rectRadius: 0.25, fill: { color: "E7B7A8", transparency: 15 }, line: { color: "C98E7C", width: 0.75 }, objectName: "erector" });
  // 胸腰筋膜
  line(s, 5.55, 1.95, 5.55, 6.05, "8E6E9C", 2);
  // ラベル（前方）
  label(s, "椎体", 0.75, 2.2, 0.85, 0.4, { fontSize: 13, bold: true });
  line(s, 1.45, 2.4, 1.9, 2.4, HEX.accent6, 0.75);
  label(s, "椎間板", 0.7, 3.0, 0.95, 0.4, { fontSize: 13, bold: true, color: C.accent2 });
  line(s, 1.55, 3.2, 1.95, 3.6, HEX.accent6, 0.75);
  // ラベル（後方）
  // 椎間関節・神経根は凡例で示す（引出線が他の構造と交差しないように）
  s.addShape(S.OVAL, { x: 5.75, y: 2.47, w: 0.22, h: 0.22, fill: { color: HEX.lt1 }, line: { color: HEX.accent2, width: 1.75 }, objectName: "legend-facet" });
  label(s, "椎間関節", 6.02, 2.4, 0.9, 0.35, { fontSize: 12.5, bold: true, color: C.accent2 });
  s.addShape(S.OVAL, { x: 5.77, y: 3.1, w: 0.17, h: 0.21, fill: { color: "E9B949" }, line: { type: "none" }, objectName: "legend-root" });
  label(s, "神経根", 6.02, 3.03, 0.9, 0.35, { fontSize: 12.5, bold: true, color: "9A6F00" });
  label(s, "棘突起", 5.75, 3.85, 1.1, 0.35, { fontSize: 12.5, bold: true });
  line(s, 5.75, 4.02, bx + off[2] + bw + 1.45, top + 2 * (bh + dh) + 0.28, HEX.accent6, 0.75);
  label(s, "脊柱起立筋群", 5.75, 4.65, 1.1, 0.55, { fontSize: 12.5, bold: true, color: "A0533F" });
  line(s, 5.75, 4.9, 5.4, 4.9, HEX.accent6, 0.75);
  label(s, "胸腰筋膜", 5.75, 5.45, 1.1, 0.35, { fontSize: 12.5, bold: true, color: "6F4F80" });
  label(s, "形・比率・位置は説明用に簡略化しています", 0.8, 6.1, 5.9, 0.3, { fontSize: 11, color: C.accent6 });

  // 右：構造と役割の表
  s.addTable(
    [
      [TH("構造"), TH("主な役割"), TH("負担がかかりやすい条件（例）")],
      [TL("椎間板"), TD("髄核と線維輪から成り、荷重を分散し動きを許す"), TD("前屈しながらの荷重、長時間の同じ姿勢")],
      [TL("椎間関節"), TD("左右一対で、動く方向を制御する"), TD("反らす・ねじる動き、ねじりながらの荷重")],
      [TL("筋・筋膜"), TD("姿勢を保ち、動作の力を生む"), TD("静的保持による疲労、急な負荷")],
      [TL("神経根"), TD("椎間孔から出て下肢へ向かう"), TD("圧迫や炎症で下肢痛・しびれ")],
    ],
    Object.assign({ x: 7.2, y: 1.6, w: 5.5, colW: [1.25, 2.1, 2.15] }, TABLE_BASE)
  );
  // 椎間板の断面
  label(s, "椎間板を上から見た断面", 7.2, 5.3, 2.6, 0.3, { fontSize: 12, color: C.accent6 });
  s.addShape(S.OVAL, { x: 7.35, y: 5.65, w: 1.6, h: 0.8, fill: { color: "CFE5F2" }, line: { color: "5E9CC0", width: 1 }, objectName: "annulus" });
  s.addShape(S.OVAL, { x: 7.85, y: 5.86, w: 0.6, h: 0.38, fill: { color: "7FB6D8" }, line: { type: "none" }, objectName: "nucleus" });
  label(s, "中心：髄核（水分の多いゲル状）\n外周：線維輪（層状の線維）", 9.2, 5.6, 3.5, 0.9, { fontSize: 13 });
  source(s, "厚生労働省「職場における腰痛予防対策指針及び解説」(2013)／日本整形外科学会・日本腰痛学会「腰痛診療ガイドライン2019」");
  s.addNotes(
    [
      "【補足説明】",
      "・腰椎は5つの椎体が積み重なり、生理的な前弯（前方への緩やかなカーブ）をもちます。椎体の間に椎間板、後方に左右一対の椎間関節があり、靱帯と筋（脊柱起立筋群、多裂筋、腹筋群など）と胸腰筋膜が脊柱を支えます。",
      "・図は側面からの概念図で、前方を左に描いています。神経根は椎間孔（椎体・椎間板と椎間関節の間のすき間）から出て下肢へ向かいます。",
      "・椎間板は中心の髄核と外周の線維輪から成ります。椎間板の内圧は姿勢や荷重で変化し、前屈して荷物を持つ条件で高くなることが生体内測定で示されています（次のバイオメカニクスの章で扱います）。",
      "",
      "【判断の根拠】",
      "・腰痛予防対策指針の解説は、腰痛が椎間板・椎間関節・靱帯・筋などの構造の障害で起こること、また腰痛には臀部から下肢にかけての痛み・しびれが含まれることを説明しています。",
      "・表の「負担がかかりやすい条件」は代表例です。実際にはどの組織に負荷が集中するかは動作・個人差で変わります。",
      "",
      "【注意点】",
      "・この図は解剖学的な位置関係を簡略化した概念図です。正確な形態は解剖学の教科書・アトラスで確認してください。生成画像を解剖の根拠図として使わないでください。",
      "",
      "出典：厚生労働省「職場における腰痛予防対策指針及び解説」(2013)；日本整形外科学会・日本腰痛学会監修「腰痛診療ガイドライン2019 改訂第2版」南江堂(2019)",
    ].join("\n")
  );
}

// =========================================================
// 4. 痛みと原因組織／分類
// =========================================================
{
  const s = slideWith("1 腰痛を理解するための基礎", "1　腰痛を理解するための基礎", "痛む場所だけでは、原因となる組織は特定できない");
  // 左：概念図
  box(s, 0.6, 1.55, 5.2, 4.9, HEX.lt2, "fig-bg");
  label(s, "同じ「腰の痛み」に関わりうるもの", 0.85, 1.65, 4.8, 0.4, { fontSize: 15, bold: true, color: C.text2 });
  s.addShape(S.OVAL, { x: 2.35, y: 3.35, w: 1.7, h: 1.05, fill: { color: HEX.accent5 }, line: { type: "none" }, objectName: "pain-center" });
  label(s, "腰の痛み", 2.35, 3.35, 1.7, 1.05, { align: "center", fontSize: 16, bold: true, color: C.background1 });
  const srcs = [
    ["椎間板", 0.85, 2.2], ["椎間関節", 2.4, 2.15], ["仙腸関節", 3.95, 2.2],
    ["筋・筋膜", 0.85, 4.75], ["神経根", 2.4, 4.85], ["内臓・血管の病気", 3.85, 4.75],
  ];
  srcs.forEach(([t, x, y], i) => {
    box(s, x, y, 1.6, 0.55, HEX.lt1, "src-" + i, "B9CCCF");
    label(s, t, x, y, 1.6, 0.55, { align: "center", fontSize: 13 });
    line(s, x + 0.8, y < 3 ? y + 0.55 : y, 3.2, y < 3 ? 3.35 : 4.4, "9FB3B8", 1);
  });
  label(s, "＋ 痛みを処理する神経系の感受性、睡眠・ストレスなども痛みの感じ方に影響", 0.85, 5.6, 4.8, 0.7, { fontSize: 12.5, color: C.accent6 });

  // 右：分類の表
  s.addTable(
    [
      [TH("分類"), TH("考え方"), TH("例・補足")],
      [TL("特異的腰痛"), TD("原因となる病態を特定できる"), TD("椎間板ヘルニア、脊柱管狭窄症、圧迫骨折、感染、腫瘍など")],
      [TL("非特異的腰痛"), TD("単一の原因を特定できず、神経症状を伴わない"), TD("割合は診断の方法・医療体制で異なる（国内外で報告に差）")],
    ],
    Object.assign({ x: 6.2, y: 1.6, w: 6.5, colW: [1.55, 2.35, 2.6] }, TABLE_BASE)
  );
  label(s, "有症期間による分類（腰痛診療ガイドライン2019）", 6.2, 3.95, 6.5, 0.38, { fontSize: 15, bold: true, color: C.text2 });
  const per = [["急性", "4週未満", HEX.accent4], ["亜急性", "4週〜3か月未満", HEX.accent3], ["慢性", "3か月以上", "C6E3DD"]];
  per.forEach(([t, d, col], i) => {
    const x = 6.2 + i * 2.18;
    s.addShape(S.CHEVRON, { x, y: 4.4, w: 2.15, h: 0.85, fill: { color: col }, line: { type: "none" }, objectName: "period-" + i });
    label(s, t + "\n" + d, x + 0.25, 4.4, 1.7, 0.85, { align: "center", fontSize: 13.5, bold: i === 2 });
  });
  label(s, "期間で区切るのは、経過の見通しと評価・対応の重点が変わるためです。慢性腰痛では、組織の状態だけでなく心理・社会的要因の影響をより重視します。", 6.2, 5.4, 6.5, 1.0, { fontSize: 13.5 });
  source(s, "日本整形外科学会・日本腰痛学会「腰痛診療ガイドライン2019」／Hartvigsen J et al. Lancet 2018;391:2356-67／Suzuki H et al. PLoS One 2016;11:e0160454");
  s.addNotes(
    [
      "【補足説明】",
      "・腰痛の痛みの元になりうる組織は複数あり（椎間板、椎間関節、仙腸関節、筋・筋膜、神経根など）、痛む部位や痛み方だけでどの組織が原因かを特定することは、多くの場合困難です。Lancet腰痛シリーズ（Hartvigsen 2018）は、大多数の腰痛で痛みの発生源を正確に特定することは現時点では難しいと述べています。",
      "・また、内臓・血管の疾患（腎・尿路、婦人科、大動脈など）が腰痛として現れることもあり、受診目安の章で扱います。",
      "",
      "【特異的・非特異的腰痛】",
      "・腰痛診療ガイドライン2019では、原因を特定できるものを特異的腰痛、原因を特定できず神経症状を伴わないものを非特異的腰痛と整理しています。",
      "・「腰痛の約85％は原因不明」という数字が広く紹介されますが、国内の整形外科外来320例を詳細に評価した研究（Suzuki 2016、山口県）では78％が特異的腰痛と診断され、非特異的腰痛は22％でした。著者らは医療体制や診断方法の違いを理由に挙げています。割合は「どこで・どのように評価したか」に依存するため、一つの数字を一般化しないことが大切です。",
      "",
      "【急性・慢性】",
      "・発症からの期間で急性（4週未満）・亜急性（4週〜3か月未満）・慢性（3か月以上）に分けます。期間によって自然経過の見通しや、評価・対応の重点が変わります。",
      "",
      "【注意点】",
      "・職員同士で「それは椎間板だ」「筋肉だ」と原因を断定しないでください。痛みの評価と診断は医療機関で行います。",
      "",
      "出典：日本整形外科学会・日本腰痛学会監修「腰痛診療ガイドライン2019 改訂第2版」南江堂(2019)；Hartvigsen J, et al. What low back pain is and why we need to pay attention. Lancet 2018;391:2356-2367；Suzuki H, et al. Diagnosis and characters of non-specific low back pain in Japan: The Yamaguchi Low Back Pain Study. PLoS One 2016;11:e0160454",
    ].join("\n")
  );
}

// =========================================================
// 5. 画像所見と症状／多要因
// =========================================================
{
  const s = slideWith("1 腰痛を理解するための基礎", "1　腰痛を理解するための基礎", "画像の変化＝痛みの原因、ではない");
  label(s, "症状のない人のCT・MRIにみられる所見の割合（推定値）", 0.6, 1.55, 6.2, 0.4, { fontSize: 15, bold: true, color: C.text2 });
  s.addChart(
    pres.charts.BAR,
    [
      { name: "20歳", labels: ["椎間板の変性", "椎間板の膨隆"], values: [37, 30] },
      { name: "80歳", labels: ["椎間板の変性", "椎間板の膨隆"], values: [96, 84] },
    ],
    {
      x: 0.6, y: 1.95, w: 6.0, h: 3.7, barDir: "col", barGapWidthPct: 60,
      chartColors: ["8DBBD9", HEX.accent1],
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: '0"%"', dataLabelFontSize: 13, dataLabelColor: HEX.dk1, dataLabelFontFace: "+mn-lt",
      catAxisLabelColor: HEX.dk1, catAxisLabelFontSize: 13, catAxisLabelFontFace: "+mn-lt",
      valAxisHidden: true, valAxisMaxVal: 100, valAxisMinVal: 0,
      valGridLine: { style: "none" }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "t", legendFontSize: 13, legendFontFace: "+mn-lt", legendColor: HEX.dk1,
      objectName: "chart-imaging",
    }
  );
  label(s, "33研究・無症状者3,110人の系統的レビュー。年齢とともに所見の割合は上がる", 0.6, 5.7, 6.0, 0.6, { fontSize: 12.5, color: C.accent6 });

  // 右：多要因
  label(s, "腰痛に関わる要因（腰痛予防対策指針の分類）", 7.0, 1.55, 5.7, 0.4, { fontSize: 15, bold: true, color: C.text2 });
  const f = [
    ["動作要因", "抱え上げ、前屈・ひねり、静的姿勢、急な動作", HEX.accent4],
    ["環境要因", "狭い空間、作業面の高さ、床・段差、寒冷、照明、振動", HEX.accent4],
    ["個人的要因", "年齢、体格、既往症・基礎疾患、家庭での育児・介護の負担", HEX.accent3],
    ["心理・社会的要因", "支援不足、対人トラブル、仕事の要求度、休みにくさ", HEX.accent3],
  ];
  f.forEach(([t, d, col], i) => {
    const y = 2.05 + i * 0.86;
    box(s, 7.0, y, 5.7, 0.74, col, "factor-" + i);
    label(s, t, 7.15, y, 1.85, 0.74, { fontSize: 14.5, bold: true, color: C.text2 });
    label(s, d, 9.0, y, 3.6, 0.74, { fontSize: 13 });
  });
  label(s, "職場の腰痛で単一の要因だけが関わることは稀。複数の要因が重なって発生・悪化する", 7.0, 5.55, 5.7, 0.75, { fontSize: 14, bold: true, color: C.text1 });
  source(s, "Brinjikji W et al. AJNR 2015;36:811-6／厚生労働省「職場における腰痛予防対策指針及び解説」(2013)");
  s.addNotes(
    [
      "【補足説明：画像所見】",
      "・Brinjikjiら（2015）は、症状のない人3,110人を含む33研究の系統的レビューで、椎間板の変性は20歳で37％、80歳で96％、椎間板の膨隆は20歳で30％、80歳で84％に見られると推定しました。グラフはこの論文が示した年齢別推定値の両端（20歳・80歳）を示しています。",
      "・著者らは、変性所見の多くは加齢に伴う変化の一部であり、臨床症状と合わせて解釈する必要があると結論づけています。",
      "・したがって「MRIでヘルニアがあると言われた＝それが今の痛みの原因」とは限りません。一方で、神経症状と一致する所見など臨床的に重要な画像所見もあり、「画像は意味がない」という意味ではありません。画像の解釈は医師が症状・診察所見と合わせて行います。",
      "",
      "【補足説明：多要因】",
      "・腰痛予防対策指針は腰痛の発生要因を動作要因、環境要因、個人的要因、心理・社会的要因に分類し、職場で単独の要因だけが関与することは稀で、複数の要因が複合的に関与すると説明しています。",
      "・介護・看護作業では、指針はさらに「対象者の要因」「労働者の要因」「福祉用具の状況」「作業姿勢・動作」「作業環境」「組織体制」「心理・社会的要因」を把握するよう示しています。家庭での育児・介護の負担も影響要因として挙げられています。",
      "",
      "【関連と因果の区別】",
      "・要因の多くは横断研究などで「関連」が示されたもので、一つひとつが単独で腰痛を「引き起こす」と証明されたわけではありません。対策は複数の要因を同時に下げる方向で考えます。",
      "",
      "出典：Brinjikji W, et al. Systematic literature review of imaging features of spinal degeneration in asymptomatic populations. AJNR Am J Neuroradiol 2015;36(4):811-816；厚生労働省「職場における腰痛予防対策指針及び解説」(2013)",
    ].join("\n")
  );
}

// =========================================================
// 6. モーメントアーム
// =========================================================
pres.addSection({ title: "2 バイオメカニクス" });
{
  const s = slideWith("2 バイオメカニクス", "2　バイオメカニクスから見る腰部負担", "荷物が身体から離れるほど、腰の筋が出す力は大きくなる");
  // 2つのてこモデル
  function lever(x0, d, title, name) {
    box(s, x0, 1.55, 4.0, 3.75, HEX.lt2, name + "-bg");
    label(s, title, x0 + 0.2, 1.62, 3.6, 0.4, { fontSize: 15, bold: true, color: C.text2 });
    const fx = x0 + 1.0, fy = 3.55; // 支点（腰椎の椎間板付近）
    const e = 0.45; // 背筋の作用線までの距離（固定）
    // 梁
    s.addShape(S.RECTANGLE, { x: fx - e - 0.1, y: fy - 0.06, w: e + 0.1 + d + 0.2, h: 0.12, fill: { color: "8FA1AC" }, line: { type: "none" }, objectName: name + "-beam" });
    // 支点
    s.addShape(S.ISOSCELES_TRIANGLE, { x: fx - 0.22, y: fy + 0.06, w: 0.44, h: 0.38, fill: { color: HEX.dk2 }, line: { type: "none" }, objectName: name + "-fulcrum" });
    // 背筋の力（後方・下向き）
    const mLen = 0.35 + d * 0.38;
    arrow(s, fx - e, fy, fx - e, fy + mLen, "C0533A", 3, name + "-muscle");
    // 荷物の重さ（前方・下向き）
    s.addShape(S.ROUNDED_RECTANGLE, { x: fx + d - 0.22, y: fy - 0.5, w: 0.44, h: 0.44, rectRadius: 0.05, fill: { color: HEX.accent2 }, line: { type: "none" }, objectName: name + "-load" });
    arrow(s, fx + d, fy, fx + d, fy + 0.55, HEX.accent2, 3, name + "-loadarrow");
    // 距離の寸法線
    line(s, fx, fy - 0.75, fx + d, fy - 0.75, HEX.dk1, 1);
    line(s, fx, fy - 0.85, fx, fy - 0.65, HEX.dk1, 1);
    line(s, fx + d, fy - 0.85, fx + d, fy - 0.65, HEX.dk1, 1);
    label(s, "d", fx + d / 2 - 0.15, fy - 1.12, 0.3, 0.3, { align: "center", fontSize: 15, bold: true, italic: true });
    line(s, fx - e, fy - 0.3, fx, fy - 0.3, "C0533A", 1);
    line(s, fx - e, fy - 0.38, fx - e, fy - 0.22, "C0533A", 1);
    line(s, fx, fy - 0.38, fx, fy - 0.22, "C0533A", 1);
    label(s, "e", fx - e / 2 - 0.15, fy - 0.68, 0.3, 0.3, { align: "center", fontSize: 15, bold: true, italic: true, color: "C0533A" });
    label(s, "背筋の力", fx - e - 0.55, fy + mLen + 0.02, 1.1, 0.3, { align: "center", fontSize: 12, color: "A0442F" });
    label(s, "荷物", fx + d - 0.4, fy + 0.58, 0.8, 0.3, { align: "center", fontSize: 12, color: C.accent2 });
    label(s, "後ろ ← → 前", x0 + 0.2, 4.95, 3.6, 0.3, { align: "center", fontSize: 11, color: C.accent6 });
  }
  lever(0.6, 1.1, "A　荷物を身体に近づけて持つ", "near");
  lever(4.75, 2.35, "B　荷物が身体から離れている", "far");
  label(s, "矢印の長さは大小関係の模式であり、実測値ではありません", 0.6, 5.35, 8.15, 0.3, { fontSize: 11.5, color: C.accent6 });

  // 右：式と解説
  box(s, 9.05, 1.55, 3.65, 1.75, HEX.accent4, "formula-bg");
  label(s, "釣り合いの簡略モデル", 9.25, 1.62, 3.3, 0.35, { fontSize: 13, bold: true, color: C.text2 });
  s.addText(
    [
      { text: "背筋の力 × e", options: { color: "A0442F", bold: true, breakLine: true } },
      { text: "＝ 荷物の重さ × d", options: { color: HEX.accent2, bold: true, breakLine: true } },
      { text: "＋ 上半身の重さ × その距離", options: { color: HEX.dk1, fontSize: 14 } },
    ],
    { x: 9.25, y: 1.98, w: 3.35, h: 1.25, fontSize: 16, margin: 0, valign: "top", isTextBox: true }
  );
  s.addText(
    bullets(
      [
        "e（背筋から支点までの距離）は短く、変えにくい",
        "d が長くなるほど、釣り合うための背筋の力が増え、腰椎を押しつぶす力も増える",
        "前屈すると上半身の重心も前に出て、荷物がなくても負担が増える",
      ],
      { fontSize: 14, space: 6 }
    ),
    { x: 9.05, y: 3.45, w: 3.65, h: 2.9, valign: "top", margin: 0, isTextBox: true }
  );
  box(s, 0.6, 5.72, 8.15, 0.75, ORANGE_BG, "caution-model");
  label(s, "これは考え方を示す模型です。実際の腰部負荷は、ずれの力・動きの速さ・筋の同時収縮・個人差で変わり、この式から数値は求められません。", 0.8, 5.74, 7.8, 0.72, { fontSize: 13, color: C.text1 });
  source(s, "厚生労働省「職場における腰痛予防対策指針及び解説」別紙Ⅰ(2013)／Waters TR. Am J Nurs 2007;107(8)");
  s.addNotes(
    [
      "【補足説明：モーメント（回転させる力）】",
      "・腰椎の椎間板付近を支点とした「シーソー」として考えます。前方の荷物は上半身を前に倒そうとし（荷物の重さ×支点からの距離d）、後方の脊柱起立筋がそれに釣り合うように引っ張ります（背筋の力×距離e）。",
      "・式の意味：静止している瞬間には、前に倒す回転の効果と、後ろに引き戻す回転の効果が等しくなります。背筋は支点（脊柱）のすぐ近くにあるため e は短く、d が長いほど背筋は大きな力を出さなければなりません。その結果、筋の力と荷重が合わさって、腰椎を上下から押しつぶす方向の力（圧縮力）も大きくなります。",
      "・荷物がなくても、前屈すれば上半身自体の重心が前に移動し、同じ理屈で負担が増えます。これが「中腰・前屈」が負担になる力学的な理由です。",
      "",
      "【簡略モデルと実際の負荷の区別】",
      "・この式は2次元・静止状態の釣り合いだけを見た概念モデルです。実際には、前後にずらす力（せん断力）、動作の速さによる慣性、腹筋など他の筋の同時収縮、姿勢の三次元的な変化、個人の体格差が加わります。研修では「d を短くする」「前屈を減らす」ことの理由を理解するために用い、具体的な何kg・何倍といった数値は扱いません。",
      "・Waters（2007）は、NIOSHの改訂持ち上げ式を患者の移乗に当てはめることは、協力的で急に動かない対象者など限られた条件でしか成り立たないと述べ、可能な限り人力での持ち上げをなくすことが最善の実践としています。人を持ち上げる作業に、荷物の重量基準をそのまま当てはめないでください。",
      "",
      "【実務への接続】",
      "・腰痛予防対策指針は、作業対象にできるだけ身体を近づけること、重量物を持ったまま身体をひねらないこと、作業台を適切な高さにすることを示しています。いずれも d を短くし、前屈・回旋を減らす方向の対策です。",
      "",
      "出典：厚生労働省「職場における腰痛予防対策指針及び解説」(2013) 別紙Ⅰ 重量物取扱い作業；Waters TR. When is it safe to manually lift a patient? Am J Nurs 2007;107(8)",
    ].join("\n")
  );
}

// =========================================================
// 7. 負担を決める条件
// =========================================================
{
  const s = slideWith("2 バイオメカニクス", "2　バイオメカニクスから見る腰部負担", "姿勢の「良し悪し」ではなく、作業条件の組み合わせで評価する");
  s.addTable(
    [
      [TH("評価する条件"), TH("負担が増える方向"), TH("なぜ負担が増えるのか")],
      [TL("荷重と距離"), TD("重い・身体から遠い・つかみにくい"), TD("回転させる力（モーメント）が増え、背筋の力と圧縮力が増す")],
      [TL("姿勢"), TD("前屈＋回旋の組み合わせ、反らしながらのひねり"), TD("椎間板・椎間関節に負荷が集中しやすく、筋も不利な長さで働く")],
      [TL("時間（静的保持）"), TD("同じ前屈姿勢を保ち続ける"), TD("筋の持続的な収縮で血流が妨げられ、疲労がたまる")],
      [TL("頻度（反復）"), TD("回数が多い・休止が短い"), TD("1回は軽くても負荷が積み重なり、回復が追いつかない")],
      [TL("支持の有無"), TD("手・膝・前腕で支えられない"), TD("体重を支える経路がなく、腰部だけで上半身を支える")],
      [TL("動きの速さ・予測"), TD("急な動き、相手の不意の動き"), TD("筋の反応が遅れ、想定外の負荷がかかる")],
    ],
    Object.assign({ x: 0.6, y: 1.55, w: 8.3, colW: [1.85, 2.85, 3.6] }, TABLE_BASE)
  );
  // 右：比較例
  label(s, "同じ「前屈」でも負担は変わる（例）", 9.2, 1.55, 3.5, 0.4, { fontSize: 15, bold: true, color: C.text2 });
  box(s, 9.2, 2.0, 3.5, 1.85, ORANGE_BG, "cmp-high");
  label(s, "負担が大きくなる条件", 9.35, 2.05, 3.2, 0.35, { fontSize: 13.5, bold: true, color: C.accent5 });
  label(s, "支えなし／数分間保持／\n毎回の訪問で反復／\n利用者の体を手前に引き寄せる力を出す", 9.35, 2.4, 3.25, 1.4, { fontSize: 13.5, valign: "top" });
  box(s, 9.2, 4.0, 3.5, 1.85, HEX.accent3, "cmp-low");
  label(s, "負担が小さくなる条件", 9.35, 4.05, 3.2, 0.35, { fontSize: 13.5, bold: true, color: C.text2 });
  label(s, "ベッド柵や膝で支える／\n短時間で姿勢を戻す／\n作業を分けて合間に姿勢を変える", 9.35, 4.4, 3.25, 1.4, { fontSize: 13.5, valign: "top" });
  label(s, "→ 姿勢・荷重・時間・頻度・支持を\n　 セットで記録して比較する", 9.2, 5.9, 3.5, 0.65, { fontSize: 13.5, bold: true, color: C.text1 });
  source(s, "厚生労働省「職場における腰痛予防対策指針及び解説」(2013)／Wilke HJ et al. Spine 1999;24:755-62");
  s.addNotes(
    [
      "【補足説明】",
      "・腰痛予防対策指針は「不自然な姿勢」（前屈、中腰、ひねり、後屈ねん転など）を避けること、避けられない場合は程度を小さくし、頻度と時間を減らし、手・肘・膝を台や壁、床について身体を支えることを示しています。つまり指針自体が、姿勢を単独で「悪い」と断定するのではなく、程度・頻度・時間・支持をあわせて管理する考え方をとっています。",
      "・前屈と回旋の組み合わせは、椎間板や椎間関節に負荷が集中しやすい動きです。指針も、重量物を持ったまま身体をひねる動作は腰部への負担が極めて大きいとしています。",
      "・静的保持：筋が収縮し続けると筋内の血流が妨げられ、疲労物質が排出されにくくなります。指針の解説は、同一姿勢の長時間維持が腰部への負担を増加させると説明しています。",
      "・反復：1回の負荷が小さくても、休止が短いと回復が追いつかず負荷が蓄積します。指針は反復の周期や回数を考慮して小休止の間隔を検討することが望ましいとしています。",
      "",
      "【新しい知見：座位と立位の比較】",
      "・腰痛予防対策指針の解説には「椅座位は立位より椎間板内圧が高い」との古典的な記載があります。一方、Wilkeら（1999）が1名の健康な男性のL4-5椎間板に圧センサーを埋め込んで測定した研究では、支えのない座位の内圧は立位よりわずかに低く、前屈した立位では立位の約2倍の値でした。著者らは、姿勢を絶えず変えることが椎間板への体液の流れに重要と述べています。",
      "・ただし被験者1名の測定であり一般化には限界があります。座位か立位かという二択ではなく、前屈の程度・保持時間・姿勢変化の有無を評価する、というのがこの研修の立場です。",
      "",
      "【評価の実際】",
      "・事業所内では、同じ作業を「荷重・距離／姿勢／時間／頻度／支持」の5点で書き出すと、改善点（どれを下げられるか）が見えやすくなります。指針の「介護作業者の腰痛予防対策チェックリスト」もリスクを高・中・低で見積もる形式です。",
      "",
      "出典：厚生労働省「職場における腰痛予防対策指針及び解説」(2013)；Wilke HJ, et al. New in vivo measurements of pressures in the intervertebral disc in daily life. Spine 1999;24(8):755-762",
    ].join("\n")
  );
}

// =========================================================
// 8〜10. 訪問看護の場面別
// =========================================================
pres.addSection({ title: "3 訪問看護の場面別リスク" });

function sceneSlide(title, sceneA, sceneB, src, notes, opts = {}) {
  const s = slideWith("3 訪問看護の場面別リスク", "3　訪問看護の場面別リスクと対策の根拠", title);
  const x = 0.6;
  const w = opts.w || 12.1;
  const labelW = 1.55;
  const colW = (w - labelW) / 2;
  const rows = [
    [TH(""), TH(sceneA.name, { fontSize: 15 }), TH(sceneB.name, { fontSize: 15 })],
    [TL("負担が\n生じる理由"), TDL(sceneA.why, "。"), TDL(sceneB.why, "。")],
    [TL("評価項目"), TDL(sceneA.assess, "／"), TDL(sceneB.assess, "／")],
    [TL("対策を\n選ぶ根拠"), TDL(sceneA.basis, "。"), TDL(sceneB.basis, "。")],
  ];
  s.addTable(rows, Object.assign({ x, y: 1.55, w, colW: [labelW, colW, colW] }, TABLE_BASE));
  source(s, src);
  s.addNotes(notes);
  return s;
}

sceneSlide(
  "移乗・体位変換：人を「持ち上げない」方法を先に検討する",
  {
    name: "① ベッドと車いすの移乗",
    why: "利用者の体重を身体から離れた位置で受け止め、持ち上げ・回旋が同時に起こる。相手が急に動くと予測できない負荷が加わる",
    assess: "座位保持・立位保持・協力と理解の程度／体格差／車いすの肘掛け・フットサポートが外せるか／ベッドの高さ調整・周囲のスペース",
    basis: "指針は全介助の人力による抱え上げを原則行わず、リフト等を使うとしている。座位が保てればスライディングボード、立位が保てれば立位補助機器を含めて検討",
  },
  {
    name: "② 体位変換・ベッド上の位置調整",
    why: "低いベッドで前屈し、手前に引き寄せる・上方へずらす動作で、摩擦に逆らって大きな力を出す。前屈＋回旋になりやすい",
    assess: "ベッドの高さ／ベッドの両側から作業できるか／寝具の滑りやすさ／皮膚の脆弱性・褥瘡／利用者が膝を立てる・柵を握るなど協力できるか",
    basis: "スライディングシートは摩擦を減らし、持ち上げる力を水平に滑らせる力に置き換える。ベッドを上げて身体に近づくと前屈と d が減る",
  },
  "厚生労働省「職場における腰痛予防対策指針及び解説」別紙Ⅳ(2013)",
  [
    "【補足説明：移乗】",
    "・移乗は、利用者の体重を身体から離れた位置で受け止める（d が長い）、持ち上げと方向転換（回旋）が同時に起こる、利用者の不意の動きで予測できない負荷が加わる、という3つが重なる作業です。",
    "・腰痛予防対策指針は、移乗・入浴・排泄介助での抱え上げは腰部に著しい負担がかかるため、全介助の必要な対象者にはリフト等を積極的に使用し、原則として人力による抱え上げは行わせないこととしています。座位保持ができる場合はスライディングボード等、立位保持ができる場合はスタンディングマシーン等の使用を含めて検討するよう示しています。",
    "・指針の解説は、スライディングボードでベッドと車いす間を移乗するには、肘置きが取り外しまたは跳ね上げ可能な車いすが必要としています。用具だけでなく、組み合わせる車いす・ベッドの条件も評価項目です。",
    "",
    "【補足説明：体位変換・位置調整】",
    "・ベッド上で利用者を上方へずらす・手前に寄せる動作は、寝具との摩擦に逆らって力を出すため、見た目以上に負担が大きくなります。指針の解説は、スライディングシート等で「垂直方向への力を水平方向に展開する」ことで抱え上げずに移動できる場合があるとしています。",
    "・指針は、ベッドの高さは立位で前屈にならない高さまで上がることが望ましく、具体的には大腿上部から腰上部付近まで上がることが望ましいとしています。",
    "",
    "【注意点】",
    "・皮膚が脆弱な方では、シートを使っても引きずる操作になると皮膚のずれ・損傷につながります。シートの敷き込み方・抜き方は製品ごとの取扱説明書と実技で習得してください。",
    "・作業後はベッドの高さを利用者・家族が普段使う高さに戻し、転落リスクに配慮します。",
    "",
    "出典：厚生労働省「職場における腰痛予防対策指針及び解説」(2013) 別紙Ⅳ 福祉・医療分野等における介護・看護作業",
  ].join("\n")
);

// 9: 清拭・排泄・創傷処置／床・低いベッド（作業面高さの比較図つき）
{
  const s = slideWith("3 訪問看護の場面別リスク", "3　訪問看護の場面別リスクと対策の根拠", "清拭・排泄ケア・処置、床や低いベッド：作業面の高さが鍵");
  // 左：作業面の高さ比較図
  box(s, 0.6, 1.55, 4.1, 4.95, HEX.lt2, "fig-bg");
  label(s, "作業面の高さと身体の目安", 0.8, 1.62, 3.7, 0.35, { fontSize: 14, bold: true, color: C.text2 });
  const floorY = 5.75, scale = 4.6; // scale: 身体の高さ方向の長さ(in)
  // 身体の目安（相対位置。個人差あり）
  const marks = [["腰上部", 0.6], ["大腿上部", 0.47], ["膝", 0.28]];
  // 目盛りの縦線
  line(s, 1.5, floorY - scale * 0.68, 1.5, floorY, HEX.accent6, 1);
  marks.forEach(([t, r]) => {
    const y = floorY - scale * r;
    line(s, 1.4, y, 4.45, y, "B7C6CB", 0.75, "dash");
    label(s, t, 0.65, y - 0.17, 0.8, 0.34, { fontSize: 11.5, align: "right", color: C.accent6 });
  });
  // 床
  line(s, 0.8, floorY, 4.5, floorY, HEX.dk1, 1.5);
  // 3つの作業面
  const surf = [
    ["床の布団", 0.05, "C46A1F"],
    ["低いベッド", 0.22, "C46A1F"],
    ["上げた\n電動ベッド", 0.53, HEX.accent1],
  ];
  surf.forEach(([t, r, col], i) => {
    const x = 1.75 + i * 0.95;
    const hgt = Math.max(scale * r, 0.08);
    s.addShape(S.RECTANGLE, { x, y: floorY - hgt, w: 0.75, h: hgt, fill: { color: col, transparency: 25 }, line: { type: "none" }, objectName: "surface-" + i });
    label(s, t, x - 0.15, floorY + 0.05, 1.05, 0.55, { align: "center", fontSize: 11.5, valign: "top" });
  });
  label(s, "位置関係は目安で個人差があります", 0.8, 6.15, 3.7, 0.3, { fontSize: 10.5, color: C.accent6 });
  // 右：2場面の表
  const w = 7.75, labelW = 1.45, colW = (w - labelW) / 2;
  s.addTable(
    [
      [TH(""), TH("③ 清拭・排泄ケア・創傷処置", { fontSize: 13.5 }), TH("④ 床の布団・低いベッド", { fontSize: 13.5 })],
      [TL("負担が\n生じる理由", { fontSize: 13 }), TDL("前屈したまま細かい手作業を続ける静的保持。片手で体を支え、反対の手で処置する非対称姿勢", "。", 13), TDL("作業面が膝より低く、強い前屈か膝つき・しゃがみが避けられない。立ち上がりの反復も加わる", "。", 13)],
      [TL("評価項目", { fontSize: 13 }), TDL("処置の所要時間／ベッドの高さと幅／物品の配置（手の届く範囲か）／照明／利用者が側臥位を保てるか", "／", 13), TDL("ベッド導入の可否と利用者・家族の意向／膝つきできる床か／職員の膝・股関節の状態／作業時間と回数", "／", 13)],
      [TL("対策を\n選ぶ根拠", { fontSize: 13 }), TDL("ベッドを上げて前屈を減らし、物品を手前に置いて d を短くする。長い処置は区切って姿勢を戻す", "。", 13), TDL("指針は前屈・中腰を膝つきに置き換え、体を支えることを示す。布団では膝パッド等で膝を保護する。ベッド導入は意向を尊重して相談する", "。", 13)],
    ],
    Object.assign({ x: 4.95, y: 1.55, w, colW: [labelW, colW, colW] }, TABLE_BASE)
  );
  source(s, "厚生労働省「職場における腰痛予防対策指針及び解説」本文2(2)・別紙Ⅲ・別紙Ⅳ(2013)");
  s.addNotes(
    [
      "【補足説明：清拭・排泄ケア・創傷処置】",
      "・これらは重量物を扱う作業ではありませんが、前屈したまま細かい手作業を続ける「静的保持」と、片手で利用者の体を支えながら反対の手で処置する「非対称な姿勢」が重なります。処置時間が長いほど筋疲労が蓄積します。",
      "・対策の根拠は、作業面を上げて前屈角度を小さくする（上半身の重心のモーメントを減らす）こと、物品を手の届く範囲に置いて手を伸ばす距離（d）を短くすること、長い処置を区切って姿勢を戻す時間を作ること（静的保持の連続時間を短くする）です。",
      "",
      "【補足説明：床の布団・低いベッド】",
      "・作業面が膝より低いと、立位では強い前屈が避けられません。腰痛予防対策指針は、前屈や中腰姿勢は膝を着いた姿勢に置き換えること、床に膝を着くなどして身体を支えることを示しています。指針の解説は、作業面が低くて調節できない場合は椅子に腰掛けるかベッドや床に膝を着き、膝パッドなどで膝を保護することが望ましいとしています。",
      "・膝つき姿勢は腰部の負担を下げる一方、膝・股関節への負担が増えます。膝に障害のある職員では別の方法（低い椅子の使用、作業の分担など）を検討します。",
      "・ベッドの導入は利用者の生活・文化・住環境・費用・意向に関わる事項です。職員の負担軽減だけを理由に押し付けず、ケアマネジャー・福祉用具専門相談員と情報共有し、利用者・家族の理解を得るよう相談します。指針は、訪問介護・看護では事業者が各家庭に説明し、腰痛予防の対応策への理解を得るよう努めることを示しています。",
      "",
      "【図の見方】",
      "・図は身体指標（膝・大腿上部・腰上部）に対する作業面の高さの目安を示した概念図です。指針の解説は、ベッドの高さは大腿上部から腰上部付近まで上がることが望ましいとしています。身長や作業内容（細かい作業か、力を要する作業か）で適切な高さは変わります。",
      "",
      "出典：厚生労働省「職場における腰痛予防対策指針及び解説」(2013) 本文2(2)、別紙Ⅲ 座り作業、別紙Ⅳ 介護・看護作業",
    ].join("\n")
  );
}

sceneSlide(
  "入浴・狭い場所、医療機器のある利用者：環境と手順を先に整える",
  {
    name: "⑤ 入浴介助・狭い場所での介助",
    why: "浴室・トイレは狭く、正面に立てず回旋が増える。滑りやすい床、濡れによる冷え、高温多湿による疲労も重なる",
    assess: "作業空間の広さと職員の立ち位置／手すり・シャワーチェア・浴槽台の有無／床の滑りやすさ／湯温と室温／利用者の立位・座位の安定性",
    basis: "指針は狭い空間・滑りやすい床・寒冷を腰痛の環境要因とする。正面で作業できる立ち位置を確保し、福祉用具で利用者自身が身体を支えられるようにする",
  },
  {
    name: "⑥ 医療機器・チューブ類がある利用者",
    why: "ルートを気にして身体から離れた位置で無理な姿勢を続けやすい。体位変換時に機器・チューブを片手で保持し、非対称な姿勢になる",
    assess: "機器とルートの位置・長さの余裕／事故抜去のリスク／作業前に機器を移動できるか／必要な人数（看護師・家族等の協力者）",
    basis: "機器とルートの配置を作業前に整えると、動作中の不自然な姿勢と急な動きを防げる。手順に「ルート確認」を組み込み、人数は利用者の状態で決める",
  },
  "厚生労働省「職場における腰痛予防対策指針及び解説」本文3・別紙Ⅳ(2013)",
  [
    "【補足説明：入浴介助・狭い場所】",
    "・浴室やトイレは狭く、職員が利用者の正面に立てないことが多いため、身体をひねった姿勢（回旋）が増えます。床が濡れて滑りやすいこと、湯気による高温多湿、衣服が濡れることによる冷えも腰痛のリスク要因です。",
    "・腰痛予防対策指針の解説は、入浴介助や風呂掃除で体幹・下肢が濡れた場合の冷えは腰痛の発生リスクを高めること、狭い場所での作業はリスクを高めること、トイレのような狭い空間では手すりを取り付けて対象者と労働者の双方が身体を支えられるよう工夫することを示しています。",
    "・訪問先では住宅改修や用具の導入に時間がかかります。導入までの間は、立ち位置・手順の工夫、作業の分割、着替えや防水エプロンでの冷え対策、必要に応じた二人訪問などで対応し、リスクが高い場合は事業所へ報告して体制を検討します。",
    "",
    "【補足説明：医療機器・チューブ類】",
    "・在宅酸素、人工呼吸器、輸液ポンプ、尿道カテーテル、胃ろう・経鼻チューブ、ドレーンなどがある利用者では、事故抜去を避けようとして身体から離れた位置で無理な姿勢を続けたり、片手でルートを保持しながら体位変換をしたりしがちです。",
    "・作業前に、機器の位置・ルートの長さの余裕・固定方法を確認し、必要なら機器を移動させてから動作を始めることで、動作中の不自然な姿勢と急な動きを減らせます。これは指針が示す「作業標準を対象者ごと・介助の種類ごとに策定する」考え方の具体例です。",
    "・医療機器の取扱い自体は、各機器の添付文書・取扱説明書と主治医の指示に従います。",
    "",
    "【注意点】",
    "・利用者の尊厳とプライバシーに配慮し、入浴・排泄場面の写真撮影や共有は、目的・同意・管理方法を明確にした場合に限ります。",
    "",
    "出典：厚生労働省「職場における腰痛予防対策指針及び解説」(2013) 本文3 作業環境管理、別紙Ⅳ 介護・看護作業",
  ].join("\n")
);

// =========================================================
// 11. 用具の役割と違い
// =========================================================
pres.addSection({ title: "4 ノーリフティングと福祉用具" });
{
  const s = slideWith("4 ノーリフティングと福祉用具", "4　ノーリフティングと福祉用具の選択", "用具は「どの力を、何に置き換えるか」で選ぶ");
  s.addTable(
    [
      [TH("用具"), TH("置き換える力・役割"), TH("適応の目安（利用者側）"), TH("確認したい条件・注意")],
      [TL("リフト\n（床走行式・据置式など）"), TD("持ち上げる力そのものを機械に任せる"), TD("座位・立位の保持が難しい、全介助"), TD("スペース・吊り具の適合・皮膚状態・操作の習熟")],
      [TL("スライディング\nボード"), TD("座ったまま横に滑って移る。持ち上げを水平移動に置き換える"), TD("座位を保てる。前傾・横移動に協力できる"), TD("跳ね上げ式肘掛けの車いす、座面の高さをそろえる")],
      [TL("スライディング\nシート"), TD("摩擦を減らし、ベッド上でずらす・向きを変える力を小さくする"), TD("ベッド上の移動・体位変換が必要"), TD("敷き込み方、皮膚のずれ、使用後に抜き取る")],
      [TL("立位補助機器\n（スタンディングマシーン等）"), TD("立ち上がりと立位保持を機器が支える"), TD("立位をある程度保持でき、指示を理解できる"), TD("下肢の支持性、膝・足部の状態、機器の適合")],
    ],
    Object.assign({ x: 0.6, y: 1.55, w: 12.1, colW: [2.45, 3.4, 3.0, 3.25] }, TABLE_BASE)
  );
  box(s, 0.6, 5.6, 12.1, 0.85, HEX.accent4, "note-manual");
  label(s, "個々の製品の操作方法は、取扱説明書と実技指導で習得します。本研修は「どの用具を、なぜ選ぶか」の考え方を扱います。", 0.85, 5.62, 11.7, 0.8, { fontSize: 14.5, bold: true, color: C.text1 });
  source(s, "厚生労働省「職場における腰痛予防対策指針及び解説」別紙Ⅳ(2013)");
  s.addNotes(
    [
      "【補足説明：ノーリフティングの考え方】",
      "・ノーリフティング（ノーリフトケア）は、人力で人を抱え上げる・持ち上げる作業をなくし、福祉用具や利用者自身の残存機能を活用して移乗・移動を行う考え方です。腰痛予防対策指針は、全介助の必要な対象者にはリフト等を積極的に使用し、原則として人力による人の抱え上げは行わせないことを示しています。",
      "",
      "【用具ごとの違い】",
      "・リフト：持ち上げる力そのものを機械に置き換えます。座位・立位の保持が難しい方が主な対象です。吊り具（スリング）のサイズ・種類の適合、設置スペース、操作の習熟が前提です。",
      "・スライディングボード：座位のまま横方向に滑って移ることで、持ち上げ（垂直方向の力）を水平方向の移動に置き換えます。指針の解説は、ベッドと車いす間の移乗には肘置きが取り外しまたは跳ね上げ可能な車いすが必要としています。座面の高さをそろえる（移る先をやや低くする）ことが一般的な実務上の工夫です。",
      "・スライディングシート：摩擦を減らし、ベッド上で上方にずらす・横に寄せる・向きを変える動作の力を小さくします。移乗ではボードと組み合わせることもありますが、単独で車いすへの移乗に使う用具ではありません。",
      "・立位補助機器：立ち上がりと立位保持を支えます。指針は、対象者が立位保持できる場合にスタンディングマシーン等を検討するとしています。",
      "",
      "【注意点】",
      "・ここに挙げた適応は一般的な目安です。個々の製品で対象・禁忌・操作手順が異なるため、必ず取扱説明書を確認し、メーカーや福祉用具専門相談員・理学療法士等による実技指導を受けてください。",
      "・介護保険での福祉用具貸与・購入の対象や手続きは、ケアマネジャーと確認します。",
      "",
      "出典：厚生労働省「職場における腰痛予防対策指針及び解説」(2013) 別紙Ⅳ 福祉・医療分野等における介護・看護作業",
    ].join("\n")
  );
}

// =========================================================
// 12. 適応判断と限界
// =========================================================
{
  const s = slideWith("4 ノーリフティングと福祉用具", "4　ノーリフティングと福祉用具の選択", "適応は複数の条件で決まり、用具にも限界がある");
  // 左：判断の流れ
  label(s, "移乗方法を考える順序（一例）", 0.6, 1.55, 6.2, 0.38, { fontSize: 15, bold: true, color: C.text2 });
  const steps = [
    ["利用者の状態", "座位・立位の保持、理解と協力、痛み、皮膚の状態、体格"],
    ["使える用具と環境", "車いすの種類、ベッドの高さ、スペース、床、用具の有無"],
    ["人の条件", "職員の健康状態（腰痛の有無）、習熟度、人数、家族の協力"],
    ["方法の選択と記録", "手順・用具・人数を対象者ごとに決め、状態が変われば見直す"],
  ];
  steps.forEach(([t, d], i) => {
    const y = 2.0 + i * 1.08;
    box(s, 0.6, y, 6.2, 0.88, i === 3 ? HEX.accent3 : HEX.lt2, "step-" + i, "C9D8DA");
    s.addShape(S.OVAL, { x: 0.75, y: y + 0.19, w: 0.5, h: 0.5, fill: { color: HEX.accent1 }, line: { type: "none" }, objectName: "stepnum-" + i });
    label(s, String(i + 1), 0.75, y + 0.19, 0.5, 0.5, { align: "center", fontSize: 15, bold: true, color: C.background1 });
    label(s, t, 1.4, y + 0.04, 5.3, 0.38, { fontSize: 14.5, bold: true, color: C.text2 });
    label(s, d, 1.4, y + 0.42, 5.3, 0.42, { fontSize: 13 });
    if (i < 3) arrow(s, 3.7, y + 0.88, 3.7, y + 1.08, HEX.accent6, 1.25);
  });
  // 右：限界
  label(s, "知っておきたい限界", 7.2, 1.55, 5.5, 0.38, { fontSize: 15, bold: true, color: C.accent5 });
  const lim = [
    ["用具があれば安全とは限らない", "適合しない用具・不慣れな操作・準備の手間で、かえって不自然な姿勢や転落リスクが生じることがある"],
    ["二人介助でも腰部負担は残る", "1人あたりの重さは減っても、前屈・中腰や身長差による不均等な負荷は残る"],
    ["ボディメカニクスだけでは解決しない", "持ち上げ方の指導単独では腰痛予防効果が示されていない。作業条件そのものを変える"],
  ];
  lim.forEach(([t, d], i) => {
    const y = 2.0 + i * 1.45;
    box(s, 7.2, y, 5.5, 1.3, ORANGE_BG, "limit-" + i);
    label(s, t, 7.4, y + 0.06, 5.1, 0.4, { fontSize: 14.5, bold: true, color: C.text1 });
    label(s, d, 7.4, y + 0.47, 5.1, 0.8, { fontSize: 13, valign: "top" });
  });
  source(s, "厚生労働省「職場における腰痛予防対策指針及び解説」別紙Ⅳ(2013)／Verbeek JH et al. Cochrane Database Syst Rev 2011")
  s.addNotes(
    [
      "【補足説明：適応判断】",
      "・腰痛予防対策指針は、対象者が自立歩行・立位保持・座位保持が可能かによって介護の程度が異なるため、残存機能と介助への協力度等を踏まえた方法を選択することを示しています。対象者が職員の手や手すりをつかむだけでも負担は軽減されます。",
      "・同じ「座位が保てる」利用者でも、皮膚が脆弱でずれに弱い、痛みで前傾できない、理解が難しく急に立ち上がろうとする、肘掛けが固定の車いすしかない、といった条件で選択は変わります。条件を一つずつ確認し、選んだ方法・用具・人数を作業標準（手順書）として記録し、状態が変わるたびに見直します。指針も作業標準を対象者ごと・介助の種類ごとに作成し、対象者の状態が変わるたびに見直すよう求めています。",
      "・職員側の条件も判断に含めます。指針は、人員配置で労働者個人の健康状態（腰痛の有無を含む）、特性、技能・経験を考慮するよう示しています。",
      "",
      "【補足説明：限界】",
      "・用具：適合しない用具（サイズ違いの吊り具など）、不慣れな操作、狭い住環境での無理な設置は、かえって不自然な姿勢・転落・皮膚損傷のリスクを生みます。用具は導入後の評価と習熟の機会がセットです。",
      "・二人介助：指針の解説は、複数人での抱え上げは重量の軽減はできても前屈や中腰等の不自然な姿勢による腰痛リスクは残り、身長差が大きいと負荷が不均等になると明記しています。二人介助は「用具が使えない場合のやむを得ない方法」であり、安全な方法ではありません。",
      "・ボディメカニクス：Cochraneレビュー（Verbeek 2011）は、持ち上げ方の助言・訓練（用具の有無を問わず）が、何もしない場合と比べて腰痛や腰痛による障害を予防するという根拠はない（中等度の確実性）と結論づけています。対象研究の多くは病院・施設や物流の労働者で、訪問看護に直接当てはめることはできませんが、「技術指導だけに頼らない」根拠になります。",
      "",
      "出典：厚生労働省「職場における腰痛予防対策指針及び解説」(2013) 別紙Ⅳ；Verbeek JH, et al. Manual material handling advice and assistive devices for preventing and treating back pain in workers. Cochrane Database Syst Rev 2011;(6):CD005958",
    ].join("\n")
  );
}

// =========================================================
// 13. 居宅介護支援①：記録・PC作業
// =========================================================
pres.addSection({ title: "5 居宅介護支援のエルゴノミクス" });
{
  const s = slideWith("5 居宅介護支援のエルゴノミクス", "5　居宅介護支援のエルゴノミクス", "記録・パソコン作業：機器を身体に合わせ、姿勢を固定し続けない");
  // 左：ワークステーション概念図（側面）
  box(s, 0.6, 1.55, 5.6, 4.95, HEX.lt2, "fig-bg");
  label(s, "椅子・机・画面の位置関係（側面の概念図）", 0.8, 1.62, 5.2, 0.35, { fontSize: 13, color: C.accent6 });
  const fl = 5.95;
  line(s, 0.8, fl, 6.0, fl, HEX.dk1, 1.5);
  // 机
  s.addShape(S.RECTANGLE, { x: 3.0, y: 4.05, w: 2.9, h: 0.12, fill: { color: "9BAAB3" }, line: { type: "none" }, objectName: "desk-top" });
  s.addShape(S.RECTANGLE, { x: 5.7, y: 4.17, w: 0.1, h: fl - 4.17, fill: { color: "9BAAB3" }, line: { type: "none" } });
  // 画面
  s.addShape(S.RECTANGLE, { x: 4.95, y: 2.55, w: 0.12, h: 1.1, fill: { color: HEX.dk1 }, line: { type: "none" }, objectName: "monitor" });
  s.addShape(S.RECTANGLE, { x: 4.85, y: 3.65, w: 0.35, h: 0.4, fill: { color: "9BAAB3" }, line: { type: "none" } });
  // キーボード
  s.addShape(S.RECTANGLE, { x: 3.25, y: 3.97, w: 0.8, h: 0.08, fill: { color: HEX.dk1 }, line: { type: "none" }, objectName: "keyboard" });
  // 椅子
  s.addShape(S.RECTANGLE, { x: 1.35, y: 4.35, w: 1.25, h: 0.14, fill: { color: HEX.accent1 }, line: { type: "none" }, objectName: "chair-seat" });
  s.addShape(S.RECTANGLE, { x: 1.2, y: 3.05, w: 0.14, h: 1.44, fill: { color: HEX.accent1 }, line: { type: "none" }, objectName: "chair-back" });
  s.addShape(S.RECTANGLE, { x: 1.92, y: 4.49, w: 0.1, h: fl - 4.49 - 0.1, fill: { color: HEX.accent1 }, line: { type: "none" } });
  s.addShape(S.RECTANGLE, { x: 1.5, y: fl - 0.1, w: 0.95, h: 0.08, fill: { color: HEX.accent1 }, line: { type: "none" } });
  // 腰当て
  s.addShape(S.ROUNDED_RECTANGLE, { x: 1.34, y: 3.75, w: 0.14, h: 0.45, rectRadius: 0.05, fill: { color: "7FC2B5" }, line: { type: "none" }, objectName: "lumbar-pad" });
  // 注記（番号と引出線）
  const notesFig = [
    ["1", 1.95, 4.15], ["2", 3.65, 3.7], ["3", 5.3, 2.4], ["4", 0.95, 3.85],
  ];
  notesFig.forEach(([n, x, y], i) => {
    s.addShape(S.OVAL, { x: x - 0.17, y: y - 0.17, w: 0.34, h: 0.34, fill: { color: HEX.accent5 }, line: { type: "none" }, objectName: "fignum-" + i });
    label(s, n, x - 0.17, y - 0.17, 0.34, 0.34, { align: "center", fontSize: 12, bold: true, color: C.background1 });
  });
  label(s, "人物は描かず、機器の位置だけを示しています", 0.8, 6.05, 5.2, 0.3, { fontSize: 10.5, color: C.accent6 });
  // 右：根拠の種類を明示した表
  s.addTable(
    [
      [TH("番号・項目"), TH("目安"), TH("根拠の種類")],
      [TL("1 座面", { fontSize: 12.5 }), TD("足裏全体が床に着く高さ。届かなければ足台", { fontSize: 12.5 }), TD("公的指針\n（腰痛予防対策指針）", { fontSize: 12 })],
      [TL("2 机・入力機器", { fontSize: 12.5 }), TD("肘の曲げ角度がおよそ90度。キーボードは手前に", { fontSize: 12.5 }), TD("公的指針\n（腰痛予防対策指針）", { fontSize: 12 })],
      [TL("3 画面", { fontSize: 12.5 }), TD("視距離おおむね40cm以上。上端は目の高さとほぼ同じかやや下", { fontSize: 12.5 }), TD("公的ガイドライン\n（情報機器作業GL）", { fontSize: 12 })],
      [TL("4 背もたれ", { fontSize: 12.5 }), TD("深く腰掛け、背もたれで体幹を支える", { fontSize: 12.5 }), TD("公的指針\n（腰痛予防対策指針）", { fontSize: 12 })],
      [TL("連続作業", { fontSize: 12.5 }), TD("一連続1時間を超えない。次までに10〜15分の作業休止、途中に1〜2回の小休止", { fontSize: 12.5 }), TD("公的ガイドライン\n（情報機器作業GL）", { fontSize: 12 })],
      [TL("姿勢の変化", { fontSize: 12.5 }), TD("20〜30分を目安に立つ・姿勢を変える", { fontSize: 12.5 }), TD("研修上の実践例（最適な間隔の根拠は確立していない）", { fontSize: 12, color: HEX.accent5, bold: true })],
    ],
    Object.assign({ x: 6.45, y: 1.55, w: 6.25, colW: [1.45, 2.85, 1.95] }, TABLE_BASE)
  );
  source(s, "厚生労働省「職場における腰痛予防対策指針」本文2(2)・別紙Ⅲ(2013)／厚生労働省「情報機器作業における労働衛生管理のためのガイドライン」(2019、2021一部改正)");
  s.addNotes(
    [
      "【補足説明】",
      "・ケアマネジャー・事務職の主な腰部負担は、重量物ではなく「長時間同じ姿勢で座り続けること」（静的保持）です。腰痛予防対策指針は、長時間の座位作業では適宜立位姿勢を取ること、椅子に深く腰掛けて背もたれで体幹を支え、足裏全体が床に接する姿勢を基本とすること、前傾姿勢を避けることを示しています。",
      "・作業台の高さは肘の曲げ角度がおよそ90度になる高さ、椅子の座面は足裏全体が着く高さ（指針本文2(2)ハ）です。",
      "",
      "【数値の位置づけ（重要）】",
      "・連続作業時間：「情報機器作業における労働衛生管理のためのガイドライン」（2019年7月策定、2021年12月一部改正）は、一連続作業時間が1時間を超えないようにし、次の連続作業までの間に10〜15分の作業休止時間を設け、一連続作業時間内に1〜2回程度の小休止を設けるよう指導することを示しています。これは厚生労働省の行政ガイドラインに示された目安であり、法律で全事業者に義務づけられた数値ではありません。",
      "・画面：同ガイドラインは、おおむね40cm以上の視距離を確保し、画面の上端が眼の高さとほぼ同じか、やや下になるようにすることを示しています。",
      "・「20〜30分を目安に姿勢を変える」は、静的保持を避けるための本研修での実践例です。座位を中断する最適な間隔について確立した研究上の基準はありません。表ではオレンジ色で区別しています。",
      "",
      "【ノートPC・タブレット】",
      "・ノートPCは画面とキーボードが一体のため、画面を適切な高さにするとキーボードが高くなり、キーボードを適切にすると画面が低くなって前かがみになります。事務所では外付けキーボード・マウスとPCスタンドを使う、訪問先のタブレット入力は膝上での長時間入力を避ける、などで解決を図ります。",
      "",
      "【姿勢を固定しないこと】",
      "・「良い姿勢を保ち続ける」ことも静的保持になります。理想姿勢を一つ決めるより、姿勢を変えられる環境と業務の区切りを作ることを重視します。",
      "",
      "出典：厚生労働省「職場における腰痛予防対策指針」(2013) 本文2(2)、別紙Ⅲ 座り作業；厚生労働省「情報機器作業における労働衛生管理のためのガイドライン」(令和元年7月12日基発0712第3号、令和3年12月1日一部改正)",
    ].join("\n")
  );
}

// =========================================================
// 14. 居宅介護支援②：一日の負担
// =========================================================
{
  const s = slideWith("5 居宅介護支援のエルゴノミクス", "5　居宅介護支援のエルゴノミクス", "訪問・運転・記録が連続する一日を、負担の種類で見直す");
  // タイムライン
  const tl = [
    ["朝", "事務所で記録・連絡", "座位の静的保持", HEX.accent4],
    ["移動", "運転・乗り降り", "姿勢拘束・振動\n乗降時のひねり", "E3E8EC"],
    ["訪問", "床座り・低い座卓での面談", "前傾の保持\n立ち上がりの反復", ORANGE_BG],
    ["移動", "車内で記録・資料の出し入れ", "前かがみ・ねじれ\n片手での持ち運び", "E3E8EC"],
    ["夕方", "帰所後のまとめ記録", "疲労が蓄積した状態\nでの長時間座位", HEX.accent4],
  ];
  const tw = 2.34, gap = 0.1;
  tl.forEach(([time, what, load, col], i) => {
    const x = 0.6 + i * (tw + gap);
    box(s, x, 1.6, tw, 1.85, col, "tl-" + i);
    label(s, time, x + 0.15, 1.65, tw - 0.3, 0.36, { fontSize: 13, bold: true, color: C.accent6 });
    label(s, what, x + 0.15, 2.0, tw - 0.3, 0.6, { fontSize: 14, bold: true, color: C.text1, valign: "top" });
    label(s, load, x + 0.15, 2.65, tw - 0.3, 0.75, { fontSize: 12.5, color: C.text2, valign: "top" });
    if (i < 4) arrow(s, x + tw - 0.05, 3.55, x + tw + gap + 0.05, 3.55, HEX.accent6, 1);
  });
  line(s, 0.6, 3.55, 12.7, 3.55, "B7C6CB", 1);
  // 下：評価と根拠の表
  s.addTable(
    [
      [TH("場面"), TH("評価すること"), TH("対策を選ぶ根拠")],
      [TL("床座り・低い机", { fontSize: 13 }), TD("面談時間、座り方を変えられるか、膝・股関節の状態、椅子の使用が利用者の意向に合うか", { fontSize: 13 }), TD("指針は床の座作業をできる限り避け、やむを得ない場合は座布団を折って臀部を高くし、適宜立ち上がるとしている", { fontSize: 13 })],
      [TL("運転・乗り降り", { fontSize: 13 }), TD("連続運転時間、座席・背もたれの調整、乗降時に身体をひねっていないか", { fontSize: 13 }), TD("座席を体格に合わせて調整し、乗降はお尻から座って両脚をそろえて回すなど、ひねりを減らす", { fontSize: 13 })],
      [TL("資料の持ち運び", { fontSize: 13 }), TD("鞄の重さと持ち方（片手・片肩）、車からの出し入れの姿勢、運転直後か", { fontSize: 13 }), TD("荷を身体に近づけ左右の偏りを減らす。指針は長時間運転の直後に重い物を扱わず、休止後に行うとしている", { fontSize: 13 })],
    ],
    Object.assign({ x: 0.6, y: 3.8, w: 12.1, colW: [1.8, 4.85, 5.45] }, TABLE_BASE)
  );
  source(s, "厚生労働省「職場における腰痛予防対策指針及び解説」別紙Ⅰ・Ⅲ・Ⅴ(2013)");
  s.addNotes(
    [
      "【補足説明：一日の負担の連続】",
      "・居宅介護支援の負担は、一つひとつの作業は軽くても、静的な座位（記録）→姿勢拘束と振動（運転）→前傾の保持（床座りの面談）→ねじれ（車内での記録・資料の出し入れ）→疲労した状態での座位（帰所後の記録）と、休む間なく連続する点にあります。一日の流れを負担の種類で書き出すと、どこに区切りを入れられるかが見えます。",
      "",
      "【床座り・低い机】",
      "・腰痛予防対策指針は、直接床に座る座作業は仙腸関節・股関節等に負担がかかるためできる限り避け、やむを得ない場合は同一姿勢を保持せず適宜立ち上がって腰を伸ばすこと、あぐらでは座布団等を折り曲げて臀部を高くすることを示しています。指針の解説は、床の座作業では強い前傾姿勢が避けられず腰部の筋収縮と椎間板内圧が高まるため、小休止を長めに回数を多く取ることが望ましいとしています。",
      "・訪問先で椅子を使うかどうかは、利用者の生活習慣・意向・住環境への配慮が優先です。事前に了解を得る、面談の途中で姿勢を変える、資料を床に広げず手元に置く、などの方法も検討します。",
      "",
      "【運転・乗り降り】",
      "・腰痛予防対策指針の「車両運転等の作業」は、主にトラック・バス・タクシー等の職業運転や建設機械の振動ばく露を想定した内容です。訪問のための短距離運転の繰り返しに、その数値や結論をそのまま当てはめることはできません。共通して使えるのは、座席・背もたれを体格に合わせて調整すること、長時間の姿勢拘束を避けること、運転直後に重い物を扱わないこと、という考え方です。",
      "・乗降時の「お尻から座って両脚をそろえて回す」は、体幹のひねりを減らすための実務上の工夫であり、研究で効果が確かめられた方法ではありません。",
      "",
      "【資料の持ち運び】",
      "・片手・片肩で重い鞄を持つと体幹が側屈し、左右非対称の負荷になります。荷物を減らす（電子化・タブレットの活用）、キャリーケースやリュックを使う、車のトランクではなく座席の高さから出し入れする、などで負担を下げます。",
      "",
      "出典：厚生労働省「職場における腰痛予防対策指針及び解説」(2013) 別紙Ⅰ 重量物取扱い作業、別紙Ⅲ 座り作業、別紙Ⅴ 車両運転等の作業",
    ].join("\n")
  );
}

// =========================================================
// 15. 慢性化を考える視点
// =========================================================
pres.addSection({ title: "6 慢性化を考える視点" });
{
  const s = slideWith("6 慢性化を考える視点", "6　慢性化を考える視点", "痛みへの不安と活動低下が、痛みを長引かせることがある");
  // 恐怖回避モデル（循環図）
  box(s, 0.6, 1.55, 7.0, 4.95, HEX.lt2, "fig-bg");
  label(s, "恐怖回避モデル（Vlaeyen & Linton 2000 をもとに簡略化）", 0.8, 1.62, 6.6, 0.35, { fontSize: 13, color: C.accent6 });
  const cw = 2.1, ch = 0.85;
  const cyc = [
    ["痛みの経験", 3.05, 2.05],
    ["「動くと悪化する」\nという強い不安・解釈", 5.25, 2.95],
    ["痛みへの恐怖\n過度な警戒", 4.75, 4.55],
    ["活動の回避\n活動量の低下", 1.35, 4.55],
    ["体力・気分の低下\n痛みの持続", 0.85, 2.95],
  ];
  cyc.forEach(([t, x, y], i) => {
    box(s, x, y, cw, ch, i === 0 ? HEX.accent4 : HEX.lt1, "cyc-" + i, "B9CCCF");
    label(s, t, x, y, cw, ch, { align: "center", fontSize: 13 });
  });
  // 箱の縁どうしを結ぶ矢印
  const edge = (cx, cy, dx, dy) => {
    const k = Math.min((cw / 2 + 0.06) / Math.abs(dx || 1e-6), (ch / 2 + 0.06) / Math.abs(dy || 1e-6));
    return [cx + dx * k, cy + dy * k];
  };
  cyc.forEach((c, i) => {
    const n = cyc[(i + 1) % cyc.length];
    const ax = c[1] + cw / 2, ay = c[2] + ch / 2, bx2 = n[1] + cw / 2, by2 = n[2] + ch / 2;
    const dx = bx2 - ax, dy = by2 - ay;
    const [x1, y1] = edge(ax, ay, dx, dy);
    const [x2, y2] = edge(bx2, by2, -dx, -dy);
    arrow(s, x1, y1, x2, y2, HEX.accent5, 1.75, "cyc-arrow-" + i);
  });
  label(s, "不安が強くない場合：痛みがあっても段階的に活動を続け、回復に向かいやすい", 0.8, 6.0, 6.6, 0.42, { fontSize: 12.5, color: C.text2, bold: true });
  // 右：睡眠・ストレス
  label(s, "睡眠・疲労・仕事上のストレス", 7.95, 1.55, 4.75, 0.4, { fontSize: 15, bold: true, color: C.text2 });
  s.addText(
    bullets(
      [
        "睡眠不足・疲労・仕事上のストレスは腰痛と関連する。ただし多くは関連の報告で、どちらが原因かは一方向に決められない",
        "痛みで眠れない → 疲労で痛みに敏感になる、という双方向の関係もありうる",
        "心理・社会的要因は、個人のストレス対処だけに頼らず、組織として業務量・相談体制・休みやすさで対応する",
      ],
      { fontSize: 14, space: 8 }
    ),
    { x: 7.95, y: 2.0, w: 4.75, h: 3.0, valign: "top", margin: 0, isTextBox: true }
  );
  box(s, 7.95, 5.15, 4.75, 1.3, ORANGE_BG, "note-blame");
  label(s, "「気の持ちよう」という意味ではありません。痛みは実際に生じており、本人の責任ではありません。", 8.15, 5.2, 4.4, 1.2, { fontSize: 14, bold: true, color: C.text1 });
  source(s, "Vlaeyen JWS, Linton SJ. Pain 2000;85:317-32／厚生労働省「職場における腰痛予防対策指針及び解説」(2013)／Hartvigsen J et al. Lancet 2018");
  s.addNotes(
    [
      "【補足説明：恐怖回避モデル】",
      "・Vlaeyen & Linton（2000）は、痛みを経験したときに「動くとさらに悪化する」といった破局的な解釈が強いと、痛みへの恐怖と過度な警戒が生じ、活動を回避するようになり、その結果として身体機能の低下・抑うつ・活動制限が進んで痛みと障害が持続する、という悪循環のモデルを提案しました。恐怖が強くない場合は、痛みに向き合って活動を続けることで回復に向かいやすいとされます。",
      "・図はこのモデルを研修用に簡略化したものです。すべての慢性腰痛をこのモデルで説明できるわけではありません。",
      "",
      "【睡眠・疲労・ストレス】",
      "・腰痛予防対策指針は、心理・社会的要因（仕事への満足感の得にくさ、上司・同僚の支援不足、対人トラブル、過度な長時間労働など）が腰痛の悪化・遷延に関わるとしており、事後措置として睡眠改善や健康的なストレスコントロールの助言も挙げています。",
      "・ただし、睡眠や心理的ストレスと腰痛の関係の多くは観察研究による関連の報告であり、睡眠不足が腰痛の原因だと一方向に決めることはできません。痛みで眠れない→疲労で痛みに敏感になる、という双方向の関係も考えられます。",
      "・指針の解説は、心理・社会的要因に対しては個人レベルのストレス対処法だけに依拠せず、事業場として組織的に取り組むこと（上司・同僚のサポート、腰痛で休業することを受け入れる環境づくり、職場復帰支援、相談窓口）を求めています。",
      "",
      "【伝え方の注意】",
      "・「腰痛は気の持ちよう」「考えすぎ」といった説明は誤りであり、痛みを本人の責任にする表現は避けてください。痛みは実際に存在し、身体・心理・社会の要因が組み合わさって経過に影響する、という理解を共有します。",
      "・職員が腰痛を抱えて働いている場合、我慢を美徳とせず、早めに相談・業務調整ができる職場の雰囲気が重要です。",
      "",
      "出典：Vlaeyen JWS, Linton SJ. Fear-avoidance and its consequences in chronic musculoskeletal pain: a state of the art. Pain 2000;85(3):317-332；厚生労働省「職場における腰痛予防対策指針及び解説」(2013)；Hartvigsen J, et al. Lancet 2018;391:2356-2367",
    ].join("\n")
  );
}

// =========================================================
// 16. 運動の位置づけと限界
// =========================================================
{
  const s = slideWith("6 慢性化を考える視点", "6　慢性化を考える視点", "運動は有用な手段の一つ。ただし万能ではない");
  s.addTable(
    [
      [TH("取組"), TH("研究・指針が示していること"), TH("限界・注意")],
      [TL("運動＋教育"), TD("腰痛エピソードの予防に効果がある可能性（中等度の確実性）"), TD("効果は1年を超えると小さくなる。継続が前提")],
      [TL("運動のみ"), TD("腰痛エピソード・病欠の予防に効果がある可能性（低〜非常に低い確実性）"), TD("1年を超えると効果がみられなくなった")],
      [TL("教育のみ"), TD("予防効果はみられなかった（中等度の確実性）"), TD("知識の提供だけでは行動・環境が変わらない")],
      [TL("腰部ベルト"), TD("予防効果はみられなかった（低い確実性）。指針も一律の使用は勧めない"), TD("使う場合は個人ごとに効果を確認し、必要に応じ医師に相談")],
      [TL("慢性腰痛への運動療法"), TD("国内外の診療ガイドラインが治療の選択肢として位置づける"), TD("特定の体操が優れるという一貫した根拠は乏しい。急性期・症状がある場合は医師と相談")],
    ],
    Object.assign({ x: 0.6, y: 1.55, w: 8.4, colW: [1.9, 3.6, 2.9] }, TABLE_BASE)
  );
  label(s, "この研修での位置づけ", 9.3, 1.55, 3.4, 0.4, { fontSize: 15, bold: true, color: C.text2 });
  s.addText(
    bullets(
      [
        "運動は「作業条件の改善」の代わりにはならない",
        "腰痛予防体操（ストレッチ）は、筋疲労の回復・柔軟性・リラクセーションを目的とする（指針）",
        "痛みがあっても、医師の判断の範囲で日常の活動を保つことが勧められている",
        "「この体操で必ず治る」「筋力不足が原因」とは言えない",
      ],
      { fontSize: 14, space: 8 }
    ),
    { x: 9.3, y: 2.0, w: 3.4, h: 4.4, valign: "top", margin: 0, isTextBox: true }
  );
  source(s, "Steffens D et al. JAMA Intern Med 2016;176:199-208／WHO guideline on chronic primary low back pain (2023)／腰痛診療ガイドライン2019／腰痛予防対策指針(2013)");
  s.addNotes(
    [
      "【補足説明：予防の根拠】",
      "・Steffensら（2016）の系統的レビュー・メタ解析では、運動と教育の組み合わせが腰痛エピソードのリスクを下げることに中等度の確実性の根拠があり、運動単独でも腰痛エピソードと病欠を減らす可能性（低〜非常に低い確実性）が示されました。一方、教育のみ、腰部ベルト、靴の中敷きには予防効果がみられませんでした。また、運動の効果は1年を超える長期では小さくなる（運動＋教育）か、みられなくなりました（運動単独）。",
      "・この結果は「運動を続けることには意味があるが、一度の研修や一時的な体操で予防が完結するわけではない」ことを示しています。教育のみで効果がみられなかったことは、本研修のような教育を作業環境・体制の改善と組み合わせる必要がある根拠でもあります。",
      "",
      "【補足説明：慢性腰痛への運動療法】",
      "・腰痛診療ガイドライン2019は、慢性腰痛に対する運動療法を治療の選択肢として推奨しています。WHOの慢性一次性腰痛に関するガイドライン（2023）も、構造化された運動療法をケアの一部として提供しうるとし、腰部のベルト・サポートは日常的なケアとして用いるべきでないとしています。",
      "・Lancet腰痛シリーズ（Foster 2018）などでは、特定の種類の運動が他より明らかに優れるという一貫した根拠は乏しいとされています。続けられる運動を選ぶことが現実的です。",
      "・急性期や痛みが強い場合、ストレッチ等の実施は医師と相談するよう腰痛予防対策指針も示しています。",
      "",
      "【腰痛予防体操の位置づけ】",
      "・腰痛予防対策指針は、腰痛予防体操を筋疲労回復・柔軟性・リラクセーションを高める目的で行うとし、静的ストレッチング（反動をつけず、痛みのない範囲で20〜30秒伸ばす等）を推奨しています。体操の具体的な方法は指針の参考資料（介護・看護作業のストレッチングの例など）を参照してください。",
      "",
      "【避けたい説明】",
      "・「腰痛は筋力不足が原因」「この体操で必ず治る」は根拠のない断定です。腰痛は多要因であり、運動は管理と予防の手段の一つです。",
      "",
      "出典：Steffens D, et al. Prevention of low back pain: a systematic review and meta-analysis. JAMA Intern Med 2016;176(2):199-208；WHO. WHO guideline for non-surgical management of chronic primary low back pain in adults in primary and community care settings. 2023；日本整形外科学会・日本腰痛学会監修「腰痛診療ガイドライン2019」；Foster NE, et al. Lancet 2018;391:2368-2383；厚生労働省「職場における腰痛予防対策指針及び解説」(2013)",
    ].join("\n")
  );
}

// =========================================================
// 17. 受診・医療相談が必要な腰痛
// =========================================================
pres.addSection({ title: "7 受診・医療相談" });
{
  const s = slideWith("7 受診・医療相談", "7　受診・医療相談が必要な腰痛", "見逃したくないサインと、予防教育の境界");
  // 左：すぐに受診
  box(s, 0.6, 1.55, 6.0, 2.35, ORANGE_BG, "urgent");
  label(s, "すぐに医療機関へ（救急を含む）", 0.85, 1.62, 5.6, 0.4, { fontSize: 16, bold: true, color: C.accent5 });
  s.addText(
    bullets(
      [
        "尿が出にくい・漏れる、便失禁などの排尿・排便の異常",
        "肛門・会陰部（股の間）の感覚が鈍い",
        "両脚のしびれや脱力が急に出る・進む",
      ],
      { fontSize: 14.5, space: 5 }
    ),
    { x: 0.85, y: 2.05, w: 5.6, h: 1.8, valign: "top", margin: 0, isTextBox: true }
  );
  // 左下：早めに受診
  box(s, 0.6, 4.05, 6.0, 2.4, HEX.lt2, "soon", "C9D8DA");
  label(s, "早めに受診・医療相談を", 0.85, 4.12, 5.6, 0.4, { fontSize: 16, bold: true, color: C.text2 });
  s.addText(
    bullets(
      [
        "発熱を伴う、安静にしていても・夜間も続く痛み",
        "転倒・転落などの外傷後（特に骨粗しょう症・ステロイド長期使用）",
        "がんの既往、説明できない体重減少",
        "片脚のしびれ・筋力低下が続く、痛みが徐々に強くなる",
      ],
      { fontSize: 14, space: 4 }
    ),
    { x: 0.85, y: 4.55, w: 5.6, h: 1.85, valign: "top", margin: 0, isTextBox: true }
  );
  // 右：境界
  label(s, "レッドフラッグの意味", 7.0, 1.55, 5.7, 0.4, { fontSize: 15, bold: true, color: C.text2 });
  s.addText(
    bullets(
      [
        "重い病気を「疑う手がかり」であり、診断を確定するものではない",
        "単独の項目では診断の精度が限られる。複数の情報を組み合わせて医師が判断する",
      ],
      { fontSize: 14, space: 6 }
    ),
    { x: 7.0, y: 2.0, w: 5.7, h: 1.6, valign: "top", margin: 0, isTextBox: true }
  );
  label(s, "一般的な予防教育と個別の診療の境界", 7.0, 3.75, 5.7, 0.4, { fontSize: 15, bold: true, color: C.text2 });
  s.addTable(
    [
      [TH("この研修で扱う"), TH("医師・産業医等が行う")],
      [TD("負担の仕組み、作業条件の評価、予防の考え方、受診の目安", { fontSize: 13 }), TD("原因の診断、画像の解釈、治療、運動療法の処方、就業可否・業務制限の判断", { fontSize: 13 })],
    ],
    Object.assign({ x: 7.0, y: 4.2, w: 5.7, colW: [2.85, 2.85] }, TABLE_BASE)
  );
  label(s, "職員同士で診断や治療を代わりに行わず、上長に相談して業務を調整します。", 7.0, 5.65, 5.7, 0.75, { fontSize: 13.5, bold: true, color: C.text1 });
  source(s, "腰痛診療ガイドライン2019／Downie A et al. BMJ 2013;347:f7095／Finucane LM et al. JOSPT 2020;50:350-72／腰痛予防対策指針(2013)");
  s.addNotes(
    [
      "【補足説明：見逃したくない症状】",
      "・馬尾症候群が疑われる症状（排尿・排便の異常、会陰部の感覚低下、両下肢の神経症状の急な出現・進行）は緊急性が高く、すぐに医療機関を受診します。",
      "・発熱を伴う腰痛（感染）、外傷後の腰痛（骨折。骨粗しょう症やステロイドの長期使用があると軽い外傷でも起こりうる）、がんの既往や説明できない体重減少（転移性腫瘍）、安静時・夜間も続く痛み、進行する神経症状などは、早めの受診が勧められるサインです。腰痛診療ガイドライン2019も、重篤な脊椎疾患の合併を疑う危険信号（レッドフラッグ）を挙げています。",
      "・腰の痛みは、腎・尿路系、婦人科疾患、大動脈の病気など脊椎以外の病気で起こることもあります（腰痛予防対策指針も基礎疾患として血管性疾患・婦人科疾患・泌尿器系疾患を挙げています）。",
      "",
      "【レッドフラッグは診断ではない】",
      "・Downieら（2013）の系統的レビューは、多くのレッドフラッグ単独では骨折や悪性腫瘍の検出精度が限られ、一部の項目（高齢、ステロイドの長期使用、強い外傷、挫傷・擦過傷の存在など）で骨折の可能性が高まることを示しました。",
      "・国際的なフレームワーク（Finucane 2020）は、レッドフラッグを単独のチェックリストとしてではなく、リスク因子・症状・経過を組み合わせた臨床推論の中で扱うことを求めています。",
      "・つまり「当てはまらない＝安心」「一つ当てはまる＝重病」ではありません。気になる症状があれば受診・医療相談につなげることが、この研修で求める判断です。",
      "",
      "【予防教育と診療の境界】",
      "・本研修は一般的な予防教育です。職員の多くは医療専門職ですが、同僚の腰痛を自分たちで診断・治療することは、評価の偏りや責任の所在の不明確さにつながります。症状のある職員の診断・治療、運動療法の処方、就業可否・業務制限の判断は医師・産業医等が行い、事業所は医師の意見を踏まえて業務を調整します（腰痛予防対策指針の健康管理・職場復帰時の措置）。",
      "",
      "出典：日本整形外科学会・日本腰痛学会監修「腰痛診療ガイドライン2019」；Downie A, et al. Red flags to screen for malignancy and fracture in patients with low back pain: systematic review. BMJ 2013;347:f7095；Finucane LM, et al. International framework for red flags for potential serious spinal pathologies. J Orthop Sports Phys Ther 2020;50(7):350-372；厚生労働省「職場における腰痛予防対策指針及び解説」(2013)",
    ].join("\n")
  );
}

// =========================================================
// 18〜21. 事例検討
// =========================================================
pres.addSection({ title: "8 事例検討" });

function caseSituation(tag, title, facts, questions, notes, src) {
  const s = slideWith("8 事例検討", tag, title);
  label(s, "状況（研修用の架空事例）", 0.6, 1.55, 7.2, 0.4, { fontSize: 15, bold: true, color: C.text2 });
  s.addTable(
    facts.map(([k, v]) => [TL(k, { fontSize: 15 }), TD(v, { fontSize: 15 })]),
    Object.assign({ x: 0.6, y: 2.0, w: 7.3, colW: [1.6, 5.7] }, TABLE_BASE)
  );
  box(s, 8.2, 1.55, 4.5, 4.9, HEX.accent4, "questions");
  label(s, "検討する問い", 8.45, 1.65, 4.0, 0.4, { fontSize: 16, bold: true, color: C.text2 });
  questions.forEach((q, i) => {
    const y = 2.15 + i * 1.05;
    s.addShape(S.OVAL, { x: 8.45, y: y + 0.05, w: 0.45, h: 0.45, fill: { color: HEX.dk2 }, line: { type: "none" }, objectName: "q-" + i });
    label(s, "Q" + (i + 1), 8.45, y + 0.05, 0.45, 0.45, { align: "center", fontSize: 12, bold: true, color: C.background1 });
    label(s, q, 9.05, y, 3.5, 0.95, { fontSize: 14, valign: "top" });
  });
  source(s, src);
  s.addNotes(notes);
  return s;
}

caseSituation(
  "8　専門的な事例検討（訪問看護）",
  "事例A　片麻痺のある利用者の移乗と陰部洗浄",
  [
    ["利用者", "80代男性。脳梗塞後の右片麻痺。端座位は手すりがあれば数分保てるが、立位は不安定。指示はおおむね理解できる"],
    ["医療・皮膚", "尿道カテーテル留置。仙骨部に消えない発赤がある"],
    ["環境", "6畳の和室に介護用ベッド。高さ調整は可能だが家族は最も低い位置で使用。片側は家具で狭い。車いすは肘掛け固定式"],
    ["家族", "妻（80代）と二人暮らし。妻も腰痛がある"],
    ["職員と作業", "看護師1名で訪問（この日5件目、腰痛の既往あり）。通院準備のための車いす移乗と、陰部洗浄を行う"],
  ],
  [
    "どの条件が腰部負担を増やしているか",
    "追加で何を評価する必要があるか",
    "どの方法・用具を選ぶか",
    "その選択の根拠と限界は何か",
  ],
  [
    "【進め方】個人で2分考え、近くの人と2分話し合い、解説に進みます（合計5〜6分）。",
    "",
    "【講師向けの着眼点】",
    "・負担を増やしている条件：最も低い位置のベッド（前屈・dの増大）、片側が家具で狭い（正面に立てず回旋）、肘掛け固定の車いす（横移動ができず持ち上げが必要になる）、立位が不安定（立位を介した移乗は危険）、看護師1名で5件目（疲労の蓄積）、腰痛の既往、カテーテル（ルートを気にした無理な姿勢）、仙骨部の発赤（引きずりで悪化させない配慮が必要）。",
    "・追加の評価：端座位の安定性（どの程度の時間・支えで保てるか、前傾・側方への体重移動ができるか）、非麻痺側上肢でつかまる力、移乗の頻度（毎回の訪問か、通院時のみか）、福祉用具の導入状況と介護保険の利用状況、家族の介助場面（妻が日常的に移乗しているか＝家族の腰痛リスク）、ベッドの片側のスペースを作れるか、看護師本人の現在の症状。",
    "・答えは一つではありません。「どの条件がそろえば、どの方法になるか」を言語化することが目的です。",
    "",
    "【注意】架空事例です。実在の利用者・職員とは関係ありません。",
    "",
    "出典（考え方の根拠）：厚生労働省「職場における腰痛予防対策指針及び解説」(2013) 別紙Ⅳ",
  ].join("\n"),
  "研修用に作成した架空事例。判断の根拠は厚生労働省「職場における腰痛予防対策指針及び解説」別紙Ⅳ(2013)"
);

// 19: 事例A 解説
{
  const s = slideWith("8 事例検討", "8　専門的な事例検討（訪問看護）", "事例A　解説：条件によって選択は変わる");
  s.addTable(
    [
      [TH("追加評価の結果（条件）"), TH("選ぶ方法・用具"), TH("根拠"), TH("限界・注意")],
      [TD("端座位が安定し、非麻痺側で体重移動できる。跳ね上げ式肘掛けの車いすに変更できる", { fontSize: 13 }), TD("スライディングボードで座位のまま横移動", { fontSize: 13, bold: true }), TD("座位保持が可能ならボードを検討（指針）。持ち上げを水平移動に置き換える", { fontSize: 13 }), TD("車いすの変更・用具の手配に時間がかかる。発赤部をこすらない手順が必要", { fontSize: 13 })],
      [TD("端座位が短時間しか保てない、または体格差が大きく協力が不安定", { fontSize: 13 }), TD("リフトの導入をケアマネ・福祉用具専門相談員と検討", { fontSize: 13, bold: true }), TD("座位・立位の保持が難しい場合はリフト。人力の抱え上げは原則行わない（指針）", { fontSize: 13 }), TD("和室のスペース・設置可否、家族の操作習熟。導入までの移乗は通院日の調整や人員で対応", { fontSize: 13 })],
      [TD("どの条件でも共通（陰部洗浄・ベッド上の作業）", { fontSize: 13 }), TD("作業時はベッドを上げ、終了後に戻す。ルートを先に整え、シートで位置調整", { fontSize: 13, bold: true }), TD("前屈とdを減らす。動作中の不意な姿勢を防ぐ", { fontSize: 13 }), TD("家具の移動は家族の了解が必要。作業後の高さ戻し忘れは転落リスク", { fontSize: 13 })],
    ],
    Object.assign({ x: 0.6, y: 1.55, w: 12.1, colW: [3.3, 2.75, 3.1, 2.95] }, TABLE_BASE)
  );
  box(s, 0.6, 5.35, 12.1, 1.1, ORANGE_BG, "caseA-note");
  label(s, "立位が不安定な状態での「立たせて回る」移乗や、看護師1名での抱え上げは選ばない。職員の腰痛既往も配置・訪問順の判断材料として事業所で共有する。", 0.85, 5.38, 11.7, 1.05, { fontSize: 14.5, bold: true, color: C.text1 });
  source(s, "厚生労働省「職場における腰痛予防対策指針及び解説」本文2(3)・別紙Ⅳ(2013)");
  s.addNotes(
    [
      "【模範解説】",
      "・この事例の要点は、同じ利用者でも追加評価の結果によって選ぶ方法が変わることです。",
      "",
      "1) 端座位が安定しており、非麻痺側（左）へ体重を移せ、車いすを跳ね上げ式肘掛けのものに変更できる場合：スライディングボードによる座位での横移動が候補になります。根拠は、指針が座位保持できる対象者にはスライディングボード等の使用を含めて検討するとしていること、指針の解説がボード移乗には肘置きの取り外し・跳ね上げが可能な車いすが必要としていることです。座面の高さを合わせ、非麻痺側へ移る配置にします。限界として、車いすの変更には介護保険の手続きや日数が必要で、仙骨部の発赤をこすらない手順（ボードの差し込み方、少しずつ移る）が求められます。",
      "",
      "2) 端座位が短時間しか保てない、協力が不安定、体格差が大きい場合：リフトの導入を検討します。指針は、全介助の必要な対象者にはリフト等を積極的に使用し、原則として人力の抱え上げは行わせないとしています。限界は、和室のスペース、床走行式か据置式かの選択、吊り具の適合、家族（高齢の妻）が操作に習熟できるかです。導入までの間は、通院日の送迎時間の調整、二人体制での訪問、通院手段の見直し（訪問診療への切り替えの相談など）を事業所・ケアマネジャーと検討します。二人介助でも腰部負担は残ることを前提にします。",
      "",
      "3) どの条件でも共通：陰部洗浄やベッド上の作業ではベッドを大腿上部〜腰上部付近まで上げ、終了後は家族の普段の高さに戻します。カテーテルのバッグ・ルートを先に整えてから体位を変えます。上方への移動はスライディングシートで摩擦を減らします。",
      "",
      "【職員側の条件】",
      "・看護師の腰痛既往と「5件目」という疲労は、個人の注意で補うものではなく、訪問順・人員配置の判断材料です。指針は人員配置で健康状態（腰痛の有無を含む）を考慮すること、負担の大きい業務が特定の労働者に集中しないよう配慮することを示しています。",
      "",
      "【家族への配慮】",
      "・妻も腰痛があり、日常の移乗を担っている可能性があります。家族の負担軽減の観点からも用具の検討をケアマネジャーと共有します（家族への助言は職員の役割の範囲で）。",
      "",
      "出典：厚生労働省「職場における腰痛予防対策指針及び解説」(2013) 本文2(3) 作業の実施体制、別紙Ⅳ 福祉・医療分野等における介護・看護作業",
    ].join("\n")
  );
}

caseSituation(
  "8　専門的な事例検討（居宅介護支援）",
  "事例B　訪問と記録が続くケアマネジャーの一日",
  [
    ["職員", "50代のケアマネジャー。最近、夕方になると腰の重だるさがある。下肢症状はない。月末は睡眠時間が短い"],
    ["訪問", "1日3〜4件。床座りの和室で低い座卓を囲む面談が多く、1件45〜60分"],
    ["移動", "社用の軽自動車で移動。車内で記録や資料の整理をすることが多い"],
    ["事務所", "ノートPCを机に直置き。椅子は座面高を調整できない会議用椅子。月末は給付管理で長時間入力"],
    ["持ち物", "利用者ファイルとPCを入れた重い鞄を片手で持つ"],
  ],
  [
    "どの条件が腰部負担を増やしているか",
    "追加で何を評価する必要があるか",
    "どの方法・環境調整を選ぶか",
    "その選択の根拠と限界は何か",
  ],
  [
    "【進め方】事例Aと同様に、個人で考えてから話し合います。",
    "",
    "【講師向けの着眼点】",
    "・負担を増やしている条件：床座りでの長時間の前傾保持（45〜60分×複数件）、車内での前かがみ・ねじれた姿勢での記録、ノートPC直置き（画面が低く前かがみ）、調整できない椅子（足裏が床に着かない／机との高さが合わない可能性）、月末の長時間入力（静的保持の連続）、片手での重い鞄（左右非対称の負荷）、運転直後の持ち運び、睡眠不足と疲労。",
    "・追加の評価：重だるさの経過と、レッドフラッグに当たる症状がないか（下肢症状・排尿の異常・発熱・夜間痛など）、一日の中で症状が強まる時間帯と作業の関係、椅子と机の寸法と本人の体格（座面高・肘の高さ）、鞄の重さ、連続運転時間、月末業務の配分、業務量・相談体制など心理社会的な状況。",
    "・「本人が気をつける」だけでなく、事業所として変えられる条件（備品・業務の平準化）を分けて考えることがポイントです。",
    "",
    "【注意】架空事例です。",
    "",
    "出典（考え方の根拠）：厚生労働省「職場における腰痛予防対策指針」(2013)；「情報機器作業における労働衛生管理のためのガイドライン」(2019)",
  ].join("\n"),
  "研修用に作成した架空事例。根拠は腰痛予防対策指針(2013)、情報機器作業における労働衛生管理のためのガイドライン(2019)"
);

// 21: 事例B 解説
{
  const s = slideWith("8 事例検討", "8　専門的な事例検討（居宅介護支援）", "事例B　解説：個人の工夫と組織の対策を分けて考える");
  s.addTable(
    [
      [TH("条件"), TH("選ぶ方法・環境調整"), TH("根拠"), TH("限界・注意")],
      [TD("事務所のPC作業：ノートPC直置き、調整できない椅子", { fontSize: 13 }), TD("外付けキーボードとPCスタンド。足台・腰当て。座面調整できる椅子への更新を検討", { fontSize: 13, bold: true }), TD("肘約90度・足裏が床・画面上端は目の高さかやや下（指針・情報機器GL）", { fontSize: 13 }), TD("備品更新は事業所の判断と予算が必要。代替策は暫定", { fontSize: 13 })],
      [TD("床座りの面談が長い。利用者は椅子を好まない", { fontSize: 13 }), TD("座布団を折って臀部を高く。座り方を途中で変え、資料は手元に", { fontSize: 13, bold: true }), TD("床の座作業は避けるのが原則、やむを得ない場合の方法（指針）", { fontSize: 13 }), TD("椅子を持参するかは利用者の意向が優先。膝・股関節の状態で方法が変わる", { fontSize: 13 })],
      [TD("車内での記録、運転直後の持ち運び", { fontSize: 13 }), TD("記録は停車して座席を戻してから、またはタブレットで後日入力。鞄は両肩・キャリーに", { fontSize: 13, bold: true }), TD("ねじれと前かがみの保持を減らす。運転直後の荷扱いを避ける（指針）", { fontSize: 13 }), TD("職業運転向けの指針内容を短距離運転に一般化しない", { fontSize: 13 })],
      [TD("月末の長時間入力、睡眠不足", { fontSize: 13 }), TD("入力業務の平準化、連続作業の区切り、相談しやすい体制", { fontSize: 13, bold: true }), TD("連続1時間以内と作業休止（情報機器GL）。心理社会的要因への組織対応（指針）", { fontSize: 13 }), TD("睡眠と腰痛は関連であり、因果は一方向に断定できない", { fontSize: 13 })],
    ],
    Object.assign({ x: 0.6, y: 1.55, w: 12.1, colW: [2.75, 3.45, 3.2, 2.7] }, TABLE_BASE)
  );
  box(s, 0.6, 5.7, 12.1, 0.75, HEX.accent4, "caseB-note");
  label(s, "重だるさが続く・強まる、下肢症状や排尿の異常が出る場合は、作業の工夫ではなく受診・医療相談を優先する。", 0.85, 5.72, 11.7, 0.7, { fontSize: 14, bold: true, color: C.text1 });
  source(s, "腰痛予防対策指針 本文2(2)・別紙Ⅲ・Ⅴ(2013)／情報機器作業における労働衛生管理のためのガイドライン(2019、2021一部改正)");
  s.addNotes(
    [
      "【模範解説】",
      "・この事例では、同じ「腰の重だるさ」でも、どの条件を変えられるかで選択が変わります。また、個人でできる工夫と、事業所として行う対策（備品・業務配分・相談体制）を分けて考えます。",
      "",
      "1) 事務所のPC作業：ノートPCの直置きは画面が低く前かがみになりやすいため、外付けキーボード・マウスとPCスタンドで画面を上げます。座面を調整できない椅子で足裏が床に着かない場合は足台、背もたれと腰の間にすき間がある場合は腰当てで暫定的に対応します。根本的には調整可能な椅子への更新を事業所が検討します（腰痛予防対策指針は、体格に合った、または調節できる椅子・机を使用させることを示しています）。",
      "",
      "2) 床座りの面談：指針は床の座作業をできる限り避けるとしていますが、訪問先では利用者の生活様式と意向が優先されます。椅子の使用を利用者が望まない場合は、座布団を折って臀部を高くする、正座・横座り・あぐらを途中で変える、資料を床に広げず手元に置く、面談の区切りで姿勢を戻す、などを選びます。膝・股関節に痛みがある職員では方法を変えます。",
      "",
      "3) 車内記録と持ち運び：運転席でハンドルを避けて身体をねじりながら記録する姿勢は、前かがみとねじれの保持になります。停車後に座席を後ろに下げて背もたれを使う、記録はタブレットで後から事務所で入力する、などを選びます。指針は長時間運転の直後に重い物を扱わないことを示しています。ただし指針の車両運転の項目は職業運転を想定しているため、短距離運転への一般化には注意が必要です。",
      "",
      "4) 月末業務と睡眠：情報機器作業ガイドラインの連続作業時間の目安（一連続1時間を超えない、10〜15分の作業休止）を参考に区切りを作ります。月末に業務が集中する構造は個人では変えにくいため、業務の平準化・分担を事業所で検討します。睡眠不足と腰痛は関連が報告されていますが、因果は一方向に断定できません。",
      "",
      "【限界】",
      "・どの工夫も、症状が続く・強まる場合の受診の代わりにはなりません。下肢のしびれ・脱力、排尿の異常、発熱、夜間痛などがあれば受診・医療相談を優先します。",
      "",
      "出典：厚生労働省「職場における腰痛予防対策指針及び解説」(2013) 本文2(2)、別紙Ⅲ・Ⅴ；厚生労働省「情報機器作業における労働衛生管理のためのガイドライン」(2019、2021一部改正)",
    ].join("\n")
  );
}

// =========================================================
// 22〜23. 理解度確認
// =========================================================
pres.addSection({ title: "9 理解度確認と知識の整理" });

function quizSlide(title, qs, src, notes) {
  const s = slideWith("9 理解度確認と知識の整理", "9　理解度確認", title);
  qs.forEach((q, i) => {
    const y = 1.55 + i * 2.5;
    box(s, 0.6, y, 6.3, 2.35, HEX.lt2, "q-bg-" + i, "C9D8DA");
    label(s, q.no + "　" + q.q, 0.8, y + 0.08, 5.95, 0.85, { fontSize: 14, bold: true, valign: "top" });
    s.addText(
      q.opts.map((o, j) => ({ text: o, options: { breakLine: j < q.opts.length - 1, paraSpaceAfter: 2 } })),
      { x: 0.8, y: y + 0.95, w: 5.95, h: 1.35, fontSize: 13, color: C.text1, margin: 0, valign: "top", isTextBox: true }
    );
    box(s, 7.1, y, 5.6, 2.35, HEX.accent3, "a-bg-" + i);
    s.addText(
      [
        { text: "正解：" + q.ans, options: { bold: true, color: HEX.dk2, fontSize: 14, breakLine: true, paraSpaceAfter: 3 } },
        { text: q.why, options: { fontSize: 13, color: HEX.dk1, breakLine: true, paraSpaceAfter: 3 } },
        { text: q.wrong, options: { fontSize: 13, color: HEX.dk1 } },
      ],
      { x: 7.3, y: y + 0.08, w: 5.25, h: 2.2, margin: 0, valign: "top", isTextBox: true }
    );
  });
  source(s, src);
  s.addNotes(notes);
}

quizSlide(
  "理解度確認（1）画像所見の解釈と作業条件の選択",
  [
    {
      no: "問1",
      q: "腰痛のない職員が、健診のMRIで「椎間板の変性」を指摘された。最も適切な理解はどれか。",
      opts: [
        "A　変性がある以上、介助業務は控えるべきである",
        "B　無症状でも年齢とともに多くみられる所見であり、症状・機能と合わせて解釈する",
        "C　今後の腰痛の原因が椎間板であると確定した",
        "D　画像所見に臨床的な意味はまったくない",
      ],
      ans: "B",
      why: "理由：無症状者でも椎間板の変性は加齢とともに高い割合でみられ、医師が症状・診察所見と合わせて解釈する。",
      wrong: "誤答の問題点：Aは所見だけで就業を制限している。Cは画像と痛みを同一視している。Dは神経症状と一致する所見など重要な所見の存在を無視した過度な一般化。",
    },
    {
      no: "問2",
      q: "低いベッドで、前屈したまま陰部洗浄を毎回数分間行っている。腰部負担を下げる根拠が最も明確な対策はどれか。",
      opts: [
        "A　下腹部に力を入れるよう意識して同じ方法で続ける",
        "B　ベッドを大腿上部〜腰上部付近まで上げ、物品を手前に置く",
        "C　できるだけ素早く終わらせる",
        "D　職員全員が腰部ベルトを着用する",
      ],
      ans: "B",
      why: "理由：前屈角度と手を伸ばす距離（d）を同時に減らし、上半身と荷重によるモーメントを小さくする。指針もベッドの高さ調整を示す。",
      wrong: "誤答の問題点：Aは作業条件が変わらない。Cは急な動作が想定外の負荷を生み、ケアの質も下げる。Dは予防効果が示されておらず、指針も一律の使用を勧めない。",
    },
  ],
  "Brinjikji W et al. AJNR 2015／腰痛予防対策指針及び解説(2013)／Steffens D et al. JAMA Intern Med 2016",
  [
    "【使い方】解答欄（右側）を口頭で隠すか、先に問題だけ読み上げて考える時間（各30秒程度）を取ってから解説してください。",
    "",
    "【問1の解説】",
    "・正解B。Brinjikjiら（2015）の系統的レビューでは、無症状者の椎間板の変性は20歳で37％、80歳で96％と推定され、加齢に伴う変化の一部と考えられています。",
    "・A：画像所見だけを理由に就業を制限する根拠はありません。就業上の配慮が必要かは医師が症状・所見を踏まえて判断します。",
    "・C：画像所見と将来の痛みを同一視しています。",
    "・D：逆方向の誤りです。神経症状と一致するヘルニアや骨折、腫瘍など、臨床的に重要な画像所見もあります。",
    "",
    "【問2の解説】",
    "・正解B。腰痛予防対策指針は、ベッドサイドの作業では立位で前屈にならない高さまで上がるベッドを使い、作業高を調整すること（解説では大腿上部から腰上部付近）、作業対象にできるだけ身体を近づけることを示しています。前屈角度と手を伸ばす距離の両方が減ることが根拠です。",
    "・A：指針は持ち上げ動作などで下腹部に力を入れることにも触れていますが、前屈の静的保持という作業条件自体は変わりません。",
    "・C：急な動作は筋の反応が遅れて想定外の負荷を生むことがあり、ケアの丁寧さも損ないます。",
    "・D：Steffensら（2016）のレビューで腰部ベルトの予防効果はみられず（低い確実性）、指針も一律に使用させず個人ごとに効果を確認するよう示しています。",
    "",
    "出典：Brinjikji W, et al. AJNR Am J Neuroradiol 2015;36:811-816；厚生労働省「職場における腰痛予防対策指針及び解説」(2013)；Steffens D, et al. JAMA Intern Med 2016;176:199-208",
  ].join("\n")
);

quizSlide(
  "理解度確認（2）用具の適応判断と慢性化への理解",
  [
    {
      no: "問3",
      q: "端座位は安定しているが立位は保てない利用者。指示は理解できる。車いすは肘掛け固定式。最も妥当な判断はどれか。",
      opts: [
        "A　職員2人で抱え上げれば腰の負担はなくなる",
        "B　跳ね上げ式肘掛けの車いすへの変更を検討し、スライディングボードの適応を評価する",
        "C　スライディングシートだけで車いすへ移す",
        "D　立位補助機器で立たせて移乗する",
      ],
      ans: "B",
      why: "理由：座位保持が可能ならボードを検討（指針）。ただしボード移乗には肘掛けを外せる・跳ね上げられる車いすが必要で、用具と環境をセットで評価する。",
      wrong: "誤答の問題点：Aは二人でも前屈・身長差による負担が残る。Cはシートの役割（ベッド上の摩擦軽減）と合わない。Dは立位保持ができることが前提。",
    },
    {
      no: "問4",
      q: "3か月腰痛が続く同僚が「動くと悪化しそうで、休日はずっと横になっている」と話す。最も適切な対応はどれか。",
      opts: [
        "A　気の持ちようなので、気にしないよう伝える",
        "B　筋力不足が原因なので、自分で筋トレを指導する",
        "C　受診や相談を勧め、職場として業務調整と相談体制を整える",
        "D　痛みが完全になくなるまで安静を続けるよう勧める",
      ],
      ans: "C",
      why: "理由：慢性腰痛では恐怖回避と活動低下の悪循環が関わりうる。評価と治療は医療機関で行い、職場は心理社会的要因に組織として対応する。",
      wrong: "誤答の問題点：Aは痛みを本人の責任にしている。Bは原因の断定と職員同士の治療になる。Dは活動低下を強め、安静が有効との根拠も乏しい。",
    },
  ],
  "腰痛予防対策指針及び解説(2013)／Vlaeyen & Linton. Pain 2000／腰痛診療ガイドライン2019",
  [
    "【問3の解説】",
    "・正解B。腰痛予防対策指針は、対象者が座位保持できる場合はスライディングボード等の使用を含めて検討するとし、解説ではボードでのベッド・車いす間移乗には肘置きが取り外しまたは跳ね上げ可能な車いすが必要としています。用具の適応は利用者の機能だけでなく、組み合わせる車いす・ベッド・スペースの条件で決まります。",
    "・A：指針の解説は、複数人での抱え上げでも前屈や中腰等による腰痛リスクは残り、身長差が大きいと負荷が不均等になるとしています。",
    "・C：スライディングシートは主にベッド上で摩擦を減らす用具です（ボードと組み合わせて使う場合はあります）。",
    "・D：立位補助機器は立位をある程度保持できることが前提です（指針）。",
    "",
    "【問4の解説】",
    "・正解C。恐怖回避モデル（Vlaeyen & Linton 2000）では、痛みへの恐怖から活動を回避し、活動低下が痛みと障害を持続させる悪循環が説明されています。ただし、この同僚の腰痛に何が関わっているかを職員が判断することはできません。受診・医療相談を勧め、職場としては業務調整や相談しやすい体制を整えます（指針は心理社会的要因に組織として取り組むよう求めています）。",
    "・A：痛みを本人の責任にする表現で、不適切です。",
    "・B：原因を断定し、職員同士で治療を行うことになります。運動療法は医療機関で評価したうえで行います。",
    "・D：腰痛診療ガイドライン2019は、急性腰痛に対して安静は必ずしも有効ではないとしており、慢性腰痛では活動の維持と運動療法が治療の選択肢とされています。",
    "",
    "出典：厚生労働省「職場における腰痛予防対策指針及び解説」(2013)；Vlaeyen JWS, Linton SJ. Pain 2000;85:317-332；日本整形外科学会・日本腰痛学会監修「腰痛診療ガイドライン2019」",
  ].join("\n")
);

// =========================================================
// 24. 重要事項の整理
// =========================================================
{
  const s = slideWith("9 理解度確認と知識の整理", "9　知識の整理", "この研修で押さえておきたい重要事項");
  const pts = [
    ["腰痛は多要因", "痛む場所や画像所見だけで原因組織は決まらない。身体・環境・心理社会の要因が重なる"],
    ["負担は作業条件の組み合わせ", "荷重・距離・姿勢・時間・頻度・支持をセットで評価し、姿勢だけで良し悪しを決めない"],
    ["d を短く、前屈と回旋を減らす", "作業面の高さ、立ち位置、物品の配置で、モーメントそのものを小さくする"],
    ["人を持ち上げない", "全介助の人力の抱え上げは原則避け、機能と環境に応じて用具を選ぶ"],
    ["用具・二人介助・技術にも限界", "適合と習熟が前提。二人介助でも負担は残り、技術指導だけでは予防できない"],
    ["座り続けることも負担", "機器を身体に合わせ、姿勢を変えられる環境と業務の区切りを作る"],
    ["慢性化には心理社会的要因", "恐怖回避・睡眠・ストレスは関連要因。本人の責任にせず組織で対応する"],
    ["サインを見逃さない", "排尿・排便の異常、進む神経症状、発熱、外傷後は受診。予防教育は診療の代わりではない"],
  ];
  pts.forEach(([t, d], i) => {
    const col = i < 4 ? 0 : 1;
    const row = i % 4;
    const x = 0.6 + col * 6.15;
    const y = 1.6 + row * 1.2;
    s.addShape(S.OVAL, { x, y: y + 0.12, w: 0.55, h: 0.55, fill: { color: i === 7 ? HEX.accent5 : HEX.accent1 }, line: { type: "none" }, objectName: "pt-" + i });
    label(s, String(i + 1), x, y + 0.12, 0.55, 0.55, { align: "center", fontSize: 16, bold: true, color: C.background1 });
    label(s, t, x + 0.75, y, 5.1, 0.42, { fontSize: 15.5, bold: true, color: C.text2 });
    label(s, d, x + 0.75, y + 0.42, 5.1, 0.7, { fontSize: 13, valign: "top" });
  });
  source(s, "本研修の各スライドに示した出典のまとめ（次ページの参考文献を参照）");
  s.addNotes(
    [
      "【まとめの話し方】",
      "・この研修では「何をすべきか」の暗記ではなく、「なぜそう判断するのか」の根拠を扱いました。8つの重要事項は、場面や利用者が変わっても判断の軸として使えるものです。",
      "",
      "1. 腰痛は多要因：痛みの部位や画像所見だけで原因組織は特定できない（Hartvigsen 2018、Brinjikji 2015）。",
      "2. 負担は作業条件の組み合わせ：指針も不自然な姿勢の程度・頻度・時間・支持をあわせて管理する考え方。",
      "3. d を短く、前屈と回旋を減らす：簡略モデルで理解し、数値の計算には使わない。",
      "4. 人を持ち上げない：全介助の人力の抱え上げは原則行わない（指針）。座位保持ならボード、立位保持なら立位補助機器、困難ならリフトを検討。",
      "5. 用具・二人介助・技術の限界：二人介助でも負担は残る（指針）。持ち上げ方の指導単独では予防効果が示されていない（Verbeek 2011）。",
      "6. 座り続けることも負担：数値は公式基準（情報機器作業ガイドライン）と研修上の実践例を区別する。",
      "7. 慢性化：恐怖回避モデル。睡眠・ストレスは関連要因で因果は一方向に断定しない。組織での対応が必要。",
      "8. 受診の目安：レッドフラッグは診断ではなく受診につなげる手がかり。",
      "",
      "【補足】腰痛予防は、教育だけでなく作業管理・作業環境管理・健康管理と組み合わせて継続的に取り組むものです（腰痛予防対策指針）。事業所内で気づいた作業上の負担は、上長・安全衛生の担当者へ共有してください。",
      "",
      "出典：本研修の各スライドの出典を参照",
    ].join("\n")
  );
}

// =========================================================
// 25. 参考文献
// =========================================================
{
  const s = slideWith("9 理解度確認と知識の整理", "参考文献", "参考文献（資料名・発行主体・発行年・URL）");
  const refsL = [
    "1. 厚生労働省「職場における腰痛予防対策指針及び解説」2013（基発0618第1号）https://www.mhlw.go.jp/stf/houdou/youtsuushishin.html",
    "2. 厚生労働省「腰痛予防対策」（関連資料一覧）https://www.mhlw.go.jp/stf/newpage_31158.html",
    "3. 厚生労働省「情報機器作業における労働衛生管理のためのガイドライン」2019（2021一部改正）https://www.mhlw.go.jp/content/000539603.pdf",
    "4. 日本整形外科学会・日本腰痛学会監修「腰痛診療ガイドライン2019 改訂第2版」南江堂 2019 https://minds.jcqhc.or.jp/summary/c00498/",
    "5. WHO. Guideline for non-surgical management of chronic primary low back pain in adults in primary and community care settings. 2023 https://www.who.int/publications/i/item/9789240081789",
    "6. 経済産業省「健康経営優良法人認定制度」https://www.meti.go.jp/policy/mono_info_service/healthcare/kenkoukeiei_yuryouhouzin.html",
    "7. 岩切一幸, 佐々木毅, 三木圭一. 2018年及び2019年労働者死傷病報告における業務上腰痛の発生状況. 産業衛生学雑誌 2022;64(6):354-366 https://doi.org/10.1539/sangyoeisei.2021-038-E",
    "8. Hartvigsen J, et al. What low back pain is and why we need to pay attention. Lancet 2018;391:2356-67 https://doi.org/10.1016/S0140-6736(18)30480-X",
    "9. Foster NE, et al. Prevention and treatment of low back pain: evidence, challenges, and promising directions. Lancet 2018;391:2368-83 https://doi.org/10.1016/S0140-6736(18)30489-6",
  ];
  const refsR = [
    "10. Brinjikji W, et al. Systematic literature review of imaging features of spinal degeneration in asymptomatic populations. AJNR Am J Neuroradiol 2015;36:811-6 https://www.ajnr.org/content/36/4/811",
    "11. Suzuki H, et al. Diagnosis and characters of non-specific low back pain in Japan: the Yamaguchi Low Back Pain Study. PLoS One 2016;11:e0160454 https://doi.org/10.1371/journal.pone.0160454",
    "12. Wilke HJ, et al. New in vivo measurements of pressures in the intervertebral disc in daily life. Spine 1999;24:755-62 https://pubmed.ncbi.nlm.nih.gov/10222525/",
    "13. Waters TR. When is it safe to manually lift a patient? Am J Nurs 2007;107(8) https://pubmed.ncbi.nlm.nih.gov/17667392/",
    "14. Verbeek JH, et al. Manual material handling advice and assistive devices for preventing and treating back pain in workers. Cochrane Database Syst Rev 2011;(6):CD005958 https://pubmed.ncbi.nlm.nih.gov/21678349/",
    "15. Steffens D, et al. Prevention of low back pain: a systematic review and meta-analysis. JAMA Intern Med 2016;176:199-208 https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/2481158",
    "16. Vlaeyen JWS, Linton SJ. Fear-avoidance and its consequences in chronic musculoskeletal pain: a state of the art. Pain 2000;85:317-32 https://doi.org/10.1016/S0304-3959(99)00242-0",
    "17. Downie A, et al. Red flags to screen for malignancy and fracture in patients with low back pain: systematic review. BMJ 2013;347:f7095 https://doi.org/10.1136/bmj.f7095",
    "18. Finucane LM, et al. International framework for red flags for potential serious spinal pathologies. J Orthop Sports Phys Ther 2020;50:350-72 https://doi.org/10.2519/jospt.2020.9971",
  ];
  const refRuns = (arr) => {
    const runs = [];
    arr.forEach((t, i) => {
      const m = t.match(/^(.*?)\s*(https?:\/\/\S+)$/);
      runs.push({ text: m[1], options: { breakLine: true, paraSpaceAfter: 0 } });
      runs.push({ text: m[2], options: { color: HEX.hlink, breakLine: i < arr.length - 1, paraSpaceAfter: 4 } });
    });
    return runs;
  };
  const opt = { fontSize: 10, color: C.text1, margin: 0, valign: "top", isTextBox: true };
  s.addText(refRuns(refsL), Object.assign({ x: 0.6, y: 1.5, w: 5.95, h: 5.05 }, opt));
  s.addText(refRuns(refsR), Object.assign({ x: 6.75, y: 1.5, w: 5.95, h: 5.05 }, opt));
  label(s, "URLは2026年10月の作成時に所在を確認したものです。行政資料は改訂・移動されることがあるため、利用時に最新版を確認してください。", 0.6, 6.6, 12.1, 0.35, { fontSize: 10.5, color: C.accent6 });
  s.addNotes(
    [
      "【参考文献についての注意】",
      "・資料作成にあたり、厚生労働省の腰痛予防対策指針（本文・解説）、情報機器作業ガイドライン、国内外の診療ガイドライン、査読済み論文を確認しました。",
      "・腰痛予防対策指針は2013年（平成25年6月18日）に改訂されたものが2026年10月時点の版です。2026年4月施行の改正労働安全衛生法により、高年齢労働者の労働災害防止のための措置が事業者の努力義務となっています。高年齢の職員の配置・作業条件を検討する際は、厚生労働省の関連指針（いわゆるエイジフレンドリー指針）もあわせて確認してください。",
      "・研究の多くは病院・施設の職員や他業種の労働者を対象としています。訪問看護・居宅介護支援の職員にそのまま一般化できない点に留意してください。",
      "・URLは2026年10月の作成時にWeb検索等で所在を確認したものです（一部の行政サイトは作成環境から直接閲覧できなかったため、検索結果と保存済みの資料で確認しました）。行政資料はページの移動・改訂があるため、利用時に最新版をご確認ください。",
    ].join("\n")
  );
}

// ---------- 出力 ----------
(async () => {
  await pres.writeFile({ fileName: OUT });
  if (APPLY_THEME) {
    const { applyTheme } = require(APPLY_THEME);
    await applyTheme(OUT, THEME);
  }
  console.log("written", OUT);
})();
