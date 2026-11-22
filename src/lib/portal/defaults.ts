import {
  AlcoholCheck,
  BusinessUnit,
  BusinessUnitId,
  Committee,
  EvaluationCriterion,
  ExternalLink,
  Minutes,
  FinanceMonthly,
  Goal,
  JobDescription,
  NanbyoEntry,
  NanbyoPatient,
  Notice,
  ParkingLot,
  ParkingSpace,
  PersonalSales,
  Position,
  SalesActivity,
  Staff,
  Subsidy,
  Vehicle,
  VehicleLog,
} from "./types";
import { daysAgo, toDateString } from "./util";

export const BUSINESS_UNITS: BusinessUnit[] = [
  { id: "houkan", name: "訪問看護", shortName: "訪看", badgeClass: "bg-brand-50 text-brand-700 ring-brand-200" },
  { id: "kyotaku", name: "居宅介護支援", shortName: "居宅", badgeClass: "bg-sky-50 text-sky-700 ring-sky-200" },
  { id: "uchinowa", name: "UCHINOWA", shortName: "UCHINOWA", badgeClass: "bg-amber-50 text-amber-700 ring-amber-200" },
  { id: "uchiwell", name: "Uchi Well", shortName: "Uchi Well", badgeClass: "bg-violet-50 text-violet-700 ring-violet-200" },
];

export const ALL_UNIT_IDS: BusinessUnitId[] = BUSINESS_UNITS.map((u) => u.id);

export function unitName(id: BusinessUnitId): string {
  return BUSINESS_UNITS.find((u) => u.id === id)?.name ?? id;
}

const CARE: BusinessUnitId[] = ["houkan", "kyotaku"];

/**
 * 外部システムの初期リンク。
 * ログインURLは契約ごとに異なるサービスが多いため、初期値は各サービスの公式サイトにしている。
 * 実際のログインURLは「設定 > 外部システム」から変更する想定。
 */
export const DEFAULT_LINKS: ExternalLink[] = [
  { id: "ibow", name: "iBow", description: "訪問看護 電子カルテ", category: "カルテ", url: "https://login.ibowservice.jp/", appUrl: "https://apps.apple.com/app/id1201622229", icon: "🩺", units: ["houkan"] },
  { id: "kaipoke", name: "カイポケ", description: "居宅介護支援 カルテ・請求", category: "カルテ", url: "https://r.kaipoke.biz/kaipokebiz/login/COM020102.do?code=login/", icon: "📋", units: ["kyotaku"] },
  { id: "zest", name: "ZEST(ゼスト)", description: "訪問スケジュール管理", category: "スケジュール", url: "https://homecare.zest.jp/office/01HXB3BSP9C6EGAPKWXWJVHXW5/calendar/schedule/weekly/2024/05/24", appUrl: "https://apps.apple.com/app/id1375392167", icon: "🗓️", units: CARE },
  { id: "kingoftime", name: "KING OF TIME", description: "勤怠管理(打刻・休暇申請)", category: "勤怠", url: "https://www.kingoftime.jp/usces-member/?usces_page=login", icon: "⏰", units: ["houkan", "kyotaku", "uchinowa", "uchiwell"] },
  { id: "mcs", name: "MCS", description: "医療介護専用SNS(多職種連携)", category: "連携・コミュニケーション", url: "https://www.medical-care.net/authentication/login", icon: "🤝", units: CARE },
  { id: "lineworks", name: "LINE WORKS", description: "社内チャット・連絡", category: "連携・コミュニケーション", url: "https://talk.worksmobile.com/#/", icon: "💬", units: ["houkan", "kyotaku", "uchiwell"] },
  { id: "elearning", name: "E-ラーニング(訪問看護)", description: "看護師・リハ・事務向けの研修", category: "研修・eラーニング", url: "https://cl.s-que.jp/vn/login", icon: "🎓", units: ["houkan"] },
  { id: "manual", name: "Uchi care マニュアル", description: "業務マニュアル(Notion)", category: "マニュアル", url: "https://app.notion.com/p/Uchi-care-262a1e3b053080aa9dcdcc54afe0ecf8", icon: "📖", units: ["houkan", "kyotaku", "uchinowa", "uchiwell"] },
  { id: "gdrive", name: "Googleドライブ", description: "共有フォルダ・書類保管", category: "書類管理", url: "https://drive.google.com/", icon: "📁", units: ["houkan", "kyotaku", "uchiwell"] },
  { id: "gsheets", name: "Googleスプレッドシート", description: "各種管理表", category: "書類管理", url: "https://docs.google.com/spreadsheets/", icon: "📊", units: ["houkan", "kyotaku", "uchiwell"] },
  { id: "gdocs", name: "Googleドキュメント", description: "文書・マニュアル", category: "書類管理", url: "https://docs.google.com/document/", icon: "📄", units: ["houkan", "kyotaku", "uchiwell"] },
  { id: "gslides", name: "Googleスライド", description: "研修資料・プレゼン", category: "書類管理", url: "https://docs.google.com/presentation/", icon: "🖼️", units: ["houkan", "kyotaku", "uchiwell"] },
  { id: "gforms", name: "Googleフォーム", description: "アンケート・申請フォーム", category: "書類管理", url: "https://docs.google.com/forms/", icon: "📝", units: ["houkan", "kyotaku", "uchiwell"] },
  { id: "mybridge", name: "myBridge", description: "名刺管理", category: "名刺", url: "https://jp.mybridge.com/auth/login/email", icon: "📇", units: CARE },
  { id: "enursing", name: "e-nursing 福利厚生", description: "福利厚生サービス", category: "福利厚生", url: "", appUrl: "https://apps.apple.com/app/id6744298649", icon: "🎁", units: CARE },
  { id: "uchicare-hp", name: "Uchi care ホームページ", description: "自社ホームページ", category: "その他", url: "https://uchicare.net/", icon: "🏠", units: ["houkan", "kyotaku", "uchinowa", "uchiwell"] },
  { id: "airregi", name: "Airレジ", description: "POSレジ・売上管理", category: "店舗・レジ", url: "https://airregi.jp/", icon: "🧾", units: ["uchinowa"] },
  { id: "canva", name: "Canva", description: "チラシ・SNS画像作成", category: "デザイン", url: "https://www.canva.com/", icon: "🎨", units: ["uchinowa"] },
];

/** 以前の初期URL(保存済みデータの移行で、未編集のものだけ新しいURLに置き換えるために使う) */
export const LEGACY_DEFAULT_LINK_URLS: Record<string, string[]> = {
  ibow: ["https://ewellibow.jp/"],
  kaipoke: ["https://kaipoke.biz/"],
  zest: ["https://zest.jp/", "https://homecare.zest.jp/login?r=/office?"],
  kingoftime: ["https://www.kingoftime.jp/", "https://login.ta.kingoftime.jp/admin"],
  mcs: ["https://www.medical-care.net/"],
  lineworks: ["https://line-works.com/"],
  mybridge: ["https://mybridge.com/"],
  enursing: [""],
};

/** 初期リンクの表示順(保存済みデータも、この順に並べ替える) */
export const DEFAULT_LINK_ORDER = DEFAULT_LINKS.map((l) => l.id);

/** 後から追加した初期リンク(保存済みデータにない場合に追加する) */
export const ADDED_DEFAULT_LINK_IDS = ["uchicare-hp", "elearning", "manual"];

export const MANUAL_URL = "https://app.notion.com/p/Uchi-care-262a1e3b053080aa9dcdcc54afe0ecf8";

export const DEFAULT_STAFF: Staff[] = [
  { id: "s-admin", name: "管理者(本部)", unitId: "houkan", role: "管理者", position: "経営者", isDriver: true, isSafetyManager: true, isEvaluator: true, active: true },
  { id: "s-ns1", name: "看護師A", unitId: "houkan", role: "看護師", position: "主任", isDriver: true, isSafetyManager: false, isEvaluator: false, active: true },
  { id: "s-ns2", name: "看護師B", unitId: "houkan", role: "看護師", position: "スタッフ", isDriver: true, isSafetyManager: false, isEvaluator: false, active: true },
  { id: "s-pt1", name: "理学療法士A", unitId: "houkan", role: "理学療法士", position: "リハ責任者", isDriver: true, isSafetyManager: false, isEvaluator: false, active: true },
  { id: "s-cm1", name: "ケアマネジャーA", unitId: "kyotaku", role: "ケアマネジャー", position: "所長", isDriver: true, isSafetyManager: true, isEvaluator: true, active: true },
  { id: "s-cm2", name: "ケアマネジャーB", unitId: "kyotaku", role: "ケアマネジャー", position: "スタッフ", isDriver: true, isSafetyManager: false, isEvaluator: false, active: true },
  { id: "s-shop1", name: "店舗スタッフA", unitId: "uchinowa", role: "店舗スタッフ", position: "リーダー", isDriver: false, isSafetyManager: false, isEvaluator: false, active: true },
  { id: "s-well1", name: "Uchi Wellスタッフ", unitId: "uchiwell", role: "その他", position: "スタッフ", isDriver: false, isSafetyManager: false, isEvaluator: false, active: true },
];

export const DEFAULT_VEHICLES: Vehicle[] = [
  { id: "v-1", name: "訪看1号車(軽)", plate: "○○ 580 あ 12-34", unitId: "houkan", active: true },
  { id: "v-2", name: "訪看2号車(軽)", plate: "○○ 580 い 56-78", unitId: "houkan", active: true },
  { id: "v-3", name: "居宅1号車(軽)", plate: "○○ 580 う 90-12", unitId: "kyotaku", active: true },
];

/**
 * 委員会の初期設定。開催頻度は運営基準等を踏まえた「目安」であり、
 * 自治体の指導や事業所の規程に合わせて「設定 > 委員会」から変更する。
 */
export const DEFAULT_COMMITTEES: Committee[] = [
  { id: "c-infection", name: "感染対策委員会", units: CARE, frequencyMonths: 6, description: "感染症の予防及びまん延防止のための対策を検討" },
  { id: "c-abuse", name: "虐待防止委員会", units: CARE, frequencyMonths: 12, description: "虐待の防止・早期発見のための対策を検討" },
  { id: "c-bcp", name: "BCP(業務継続計画)委員会", units: CARE, frequencyMonths: 12, description: "感染症・自然災害発生時の業務継続計画の見直し・訓練" },
  { id: "c-harassment", name: "ハラスメント防止委員会", units: ALL_UNIT_IDS, frequencyMonths: 12, description: "職場・利用者からのハラスメント対策" },
  { id: "c-risk", name: "事故防止・リスクマネジメント委員会", units: CARE, frequencyMonths: 3, description: "ヒヤリハット・事故報告の分析と再発防止策" },
  { id: "c-training", name: "研修委員会", units: CARE, frequencyMonths: 3, description: "年間研修計画の策定と実施状況の確認" },
  { id: "c-safety", name: "安全衛生委員会", units: ALL_UNIT_IDS, frequencyMonths: 1, description: "職員の健康障害防止・労働環境の改善" },
];

export const DEFAULT_CRITERIA: EvaluationCriterion[] = [
  { id: "k-skill", name: "専門性・業務遂行", description: "職種に求められる知識・技術を発揮し、業務を正確に遂行できている" },
  { id: "k-user", name: "利用者・家族対応", description: "利用者・家族の意向を尊重し、信頼関係を築けている" },
  { id: "k-team", name: "チームワーク・多職種連携", description: "報連相を徹底し、社内外の関係者と円滑に連携できている" },
  { id: "k-comply", name: "法令遵守・安全管理", description: "記録・個人情報保護・感染対策・運転マナー等のルールを守れている" },
  { id: "k-growth", name: "自己研鑽", description: "研修参加や資格取得など、主体的に学び成長している" },
  { id: "k-contrib", name: "組織貢献", description: "委員会活動や業務改善など、事業所の運営に貢献している" },
];

export function sampleNotices(): Notice[] {
  return [
    {
      id: "n-1",
      title: "【重要】アルコールチェックの記録をこのアプリに一本化します",
      body: "社用車を運転する方は、運転前・運転後に必ずアルコール検知器で測定し、「アルコールチェック」画面から記録してください。\n確認者(安全運転管理者)が不在の場合は、ビデオ通話または電話で確認を受けてください。",
      category: "重要",
      units: [],
      pinned: true,
      authorId: "s-admin",
      linkUrl: "",
      createdAt: `${daysAgo(2)}T09:00:00`,
      readBy: [],
    },
    {
      id: "n-2",
      title: "冬季の感染対策について",
      body: "インフルエンザ・新型コロナの流行期に入ります。訪問前後の手指衛生、マスク着用を徹底してください。体調不良時は無理せず管理者へ連絡をお願いします。",
      category: "お知らせ",
      units: CARE,
      pinned: false,
      authorId: "s-admin",
      linkUrl: "",
      createdAt: `${daysAgo(5)}T12:00:00`,
      readBy: [],
    },
    {
      id: "n-3",
      title: "年末の店舗営業時間について",
      body: "UCHINOWAの年末年始の営業時間が決まりました。シフト調整は来週中にお願いします。",
      category: "行事",
      units: ["uchinowa"],
      pinned: false,
      authorId: "s-admin",
      linkUrl: "",
      createdAt: `${daysAgo(7)}T15:00:00`,
      readBy: [],
    },
  ];
}

export function sampleVehicleLogs(): VehicleLog[] {
  return [
    {
      id: "vl-1",
      date: daysAgo(1),
      vehicleId: "v-1",
      driverId: "s-ns1",
      startTime: "08:45",
      endTime: "17:30",
      startOdometer: 23410,
      endOdometer: 23452,
      destinations: "利用者宅 4件(○○町・△△町)",
      purpose: "訪問看護",
      refuelLiters: null,
      notes: "",
      createdAt: `${daysAgo(1)}T17:35:00`,
    },
  ];
}

export function sampleAlcoholChecks(): AlcoholCheck[] {
  const base = {
    driverId: "s-ns1",
    vehicleId: "v-1",
    method: "対面" as const,
    detectorUsed: true,
    value: 0,
    checkerId: "s-admin",
    instructions: "",
    notes: "",
  };
  return [
    { ...base, id: "ac-1", date: daysAgo(1), time: "08:40", timing: "before", createdAt: `${daysAgo(1)}T08:41:00` },
    { ...base, id: "ac-2", date: daysAgo(1), time: "17:32", timing: "after", createdAt: `${daysAgo(1)}T17:33:00` },
  ];
}

export function sampleMinutes(): Minutes[] {
  return [
    {
      id: "m-1",
      committeeId: "c-infection",
      date: daysAgo(40),
      startTime: "17:30",
      endTime: "18:15",
      place: "訪問看護ステーション 事務所",
      attendeeIds: ["s-admin", "s-ns1", "s-cm1"],
      otherAttendees: "",
      recorderId: "s-ns1",
      agenda: "1. 冬季の感染症流行への備え\n2. 防護具の在庫確認",
      discussion: "インフルエンザ流行に備え、訪問バッグの感染対策物品を見直した。",
      decisions: "・ガウン、フェイスシールドを各車両に追加配備する\n・12月に感染対策研修を実施する",
      nextDate: "",
      attachmentUrl: "",
      createdAt: `${daysAgo(40)}T18:30:00`,
    },
  ];
}


export const DEFAULT_PARKING_LOTS: ParkingLot[] = [
  {
    id: "p-1",
    name: "本社 第1駐車場",
    unitId: "houkan",
    address: "",
    mapUrl: "",
    ownership: "自社所有",
    contractor: "",
    contact: "",
    monthlyFee: null,
    contractEnd: "",
    notes: "事務所前。夜間は施錠",
  },
  {
    id: "p-2",
    name: "第2駐車場(月極)",
    unitId: "kyotaku",
    address: "",
    mapUrl: "",
    ownership: "賃貸(月極)",
    contractor: "○○不動産",
    contact: "",
    monthlyFee: 16000,
    contractEnd: "",
    notes: "",
  },
];

const space = (id: string, lotId: string, label: string, usage: ParkingSpace["usage"], patch: Partial<ParkingSpace> = {}): ParkingSpace => ({
  id,
  lotId,
  label,
  usage,
  vehicleId: "",
  staffId: "",
  staffCarPlate: "",
  occupiedBy: "",
  occupiedUntil: "",
  notes: "",
  ...patch,
});

export const DEFAULT_PARKING_SPACES: ParkingSpace[] = [
  space("ps-1", "p-1", "1", "社用車", { vehicleId: "v-1" }),
  space("ps-2", "p-1", "2", "社用車", { vehicleId: "v-2" }),
  space("ps-3", "p-1", "3", "来客用"),
  space("ps-4", "p-2", "A", "社用車", { vehicleId: "v-3" }),
  space("ps-5", "p-2", "B", "職員通勤", { staffId: "s-cm2", staffCarPlate: "○○ 500 か 11-22" }),
  space("ps-6", "p-2", "C", "予備"),
];

export const POSITIONS: Position[] = ["経営者", "統括部長", "所長", "事務長", "リハ責任者", "主任", "リーダー", "スタッフ"];

/**
 * 職務記述書の初期案。実際の運用・規程に合わせて画面から編集する前提のたたき台。
 * 責務は1行1項目。
 */
export const DEFAULT_JOB_DESCRIPTIONS: JobDescription[] = [
  {
    id: "jd-ceo",
    position: "経営者",
    reportsTo: "(株主・取締役会)",
    mission: "Uchi care の理念とビジョンを示し、訪問看護・居宅介護支援・UCHINOWA・Uchi Well の全事業を持続的に成長させる。地域に必要とされる在宅ケアの基盤をつくり、職員が誇りを持って長く働ける組織をつくる。",
    responsibilities: [
      "経営理念・中長期ビジョン・事業計画の策定と全社への浸透",
      "年度予算・売上目標・利益計画の決定と進捗の確認",
      "新規事業・出店・設備投資・M&A 等の意思決定",
      "資金繰り・金融機関との関係構築、補助金・助成金活用の最終判断",
      "統括部長・所長・事務長の任命と育成、幹部の評価",
      "人事制度(評価・賃金・等級)と職務記述書の承認",
      "法令遵守・リスク管理体制の整備、重大事故・苦情発生時の最終責任",
      "行政・医師会・地域の関係機関とのトップ外交、ブランドの発信",
    ].join("\n"),
    authority: "全社の経営に関する最終決裁権。予算・投資・採用(幹部)・報酬・組織変更の決定。",
    qualifications: "在宅医療・介護事業の経営に関する知見。財務・労務・法令の基礎知識。",
    kpis: "全社売上・営業利益・利益率\n年間売上目標の達成率\n職員定着率・採用数\n重大事故ゼロ・行政指導での指摘事項",
  },
  {
    id: "jd-gm",
    position: "統括部長",
    reportsTo: "経営者",
    mission: "経営方針を各事業所の具体的な行動に落とし込み、全事業所の運営品質と収益を統括する。経営者と現場をつなぐ要として、所長を支援・育成する。",
    responsibilities: [
      "各事業所の事業計画・売上目標の策定支援と月次の進捗管理",
      "所長会議の主催、事業所間の情報共有と人員の調整(応援体制)",
      "所長の目標設定・評価・育成(1on1 の実施)",
      "営業戦略の立案と、主要な紹介元(病院・居宅・診療所)との関係構築",
      "サービス品質・感染対策・虐待防止・BCP 等の体制が整っているかの確認",
      "採用計画の立案と、採用面接への参加",
      "重大な事故・苦情・クレームへの対応と再発防止策の承認",
      "経営会議への報告(月次の数字、課題、改善提案)",
    ].join("\n"),
    authority: "事業所間の人員配置の調整。所長の評価(一次)。一定額までの経費の決裁。",
    qualifications: "看護師・介護支援専門員・療法士等の資格と管理職経験が望ましい。数値管理・マネジメントの経験。",
    kpis: "全事業所の売上目標達成率・利益率\n新規依頼件数\n職員離職率\n委員会・研修の実施率",
  },
  {
    id: "jd-director",
    position: "所長",
    reportsTo: "統括部長",
    mission: "事業所の管理者として、法令・運営基準に沿った適正な運営を行い、利用者に安全で質の高いサービスを提供しながら、事業所の売上目標を達成する。",
    responsibilities: [
      "事業所の管理者としての職員・業務の一元的な管理(運営基準の遵守)",
      "事業所の売上目標・利用者数目標の達成に向けた計画と実行",
      "新規依頼の受け入れ判断と、訪問スケジュール・担当者の調整",
      "職員の勤怠管理・シフト作成・業務量の調整",
      "スタッフの目標設定・人事評価(一次評価者)・面談",
      "委員会(感染対策・虐待防止・BCP 等)の開催と議事録の管理",
      "事故・ヒヤリハット・苦情への初期対応と報告",
      "実地指導・監査への対応、運営規程・重要事項説明書の管理",
      "地域の関係機関(病院・居宅・包括・医師)との連携",
    ].join("\n"),
    authority: "事業所内の業務分担・シフトの決定。新規利用者の受け入れ判断。スタッフの一次評価。",
    qualifications: "訪問看護:保健師または看護師(常勤)。居宅介護支援:主任介護支援専門員。管理者研修の修了。",
    kpis: "事業所の売上目標達成率・利益率\n利用者数・新規依頼件数\nスタッフ1人あたり訪問件数\n職員定着率\n委員会の開催率",
  },
  {
    id: "jd-admin",
    position: "事務長",
    reportsTo: "経営者",
    mission: "請求・経理・労務・総務を担い、事業の数字と法令対応を正確に支える。現場が利用者のケアに集中できる環境を整える。",
    responsibilities: [
      "介護報酬・医療保険の請求業務(レセプト)の管理と返戻・査定への対応",
      "月次の売上・経費・利益の集計と経営数値の報告(本アプリの経営数値の更新)",
      "補助金・助成金の情報収集・申請・実績報告",
      "給与計算・社会保険・労働保険の手続き、勤怠(KING OF TIME)の締め",
      "就業規則・規程類の整備、雇用契約書の管理",
      "車両・駐車場・備品・ITツールの管理と契約更新",
      "加算の算定要件・体制届の確認",
      "個人情報保護・文書管理(Googleドライブ)のルール整備",
    ].join("\n"),
    authority: "請求・経理処理の実行。一定額までの備品購入・契約の決裁。事務職員の業務分担。",
    qualifications: "医療・介護事務、経理・労務の実務経験。表計算ソフトの操作。",
    kpis: "請求ミス・返戻件数\n月次決算の締め日遵守\n補助金の獲得額\n経費削減額",
  },
  {
    id: "jd-rehab",
    position: "リハ責任者",
    reportsTo: "所長",
    mission: "訪問リハビリテーションの質と体制に責任を持ち、利用者の生活機能の維持・向上を実現する。看護職と協働し、リハ職の育成を担う。",
    responsibilities: [
      "リハ職(PT・OT・ST)の訪問スケジュール・担当の調整",
      "リハビリテーション計画書・報告書の内容確認と質の管理",
      "看護職との情報共有、看護師による定期的な訪問の調整",
      "リハ職の教育・同行訪問・技術指導、新人の育成計画",
      "福祉用具・住宅改修に関する助言、ケアマネジャーとの連携",
      "リハ職の目標設定と評価への参加",
      "リハ部門の売上・訪問件数の管理",
    ].join("\n"),
    authority: "リハ職の担当割り振り。リハ計画の内容確認・差し戻し。",
    qualifications: "理学療法士・作業療法士・言語聴覚士。臨床経験5年以上が望ましい。",
    kpis: "リハ職1人あたり訪問件数・売上\nリハ計画・報告書の期限内提出率\n利用者の機能評価の改善",
  },
  {
    id: "jd-chief",
    position: "主任",
    reportsTo: "所長",
    mission: "所長を補佐し、現場の実務リーダーとしてケアの質を高める。スタッフの相談役となり、教育と業務改善を推進する。",
    responsibilities: [
      "所長不在時の代行(新規依頼の一次対応・緊急時の判断)",
      "スタッフの同行訪問・OJT・新人教育の計画と実施",
      "看護記録・計画書・報告書の内容確認",
      "困難事例のカンファレンスの主催",
      "研修委員会など委員会活動の推進",
      "スタッフからの相談対応、業務改善の提案",
      "自らも訪問を担当し、模範となるケアを実践する",
    ].join("\n"),
    authority: "記録類の確認・差し戻し。スタッフへの業務指示。所長の不在時の代行。",
    qualifications: "看護師等の資格。訪問看護または該当分野の経験3年以上。",
    kpis: "個人の訪問件数・売上\n新人の独り立ちまでの期間\n記録の期限内完了率\n研修の実施回数",
  },
  {
    id: "jd-leader",
    position: "リーダー",
    reportsTo: "主任・所長",
    mission: "チームの中心として日々の業務を円滑に回し、メンバーの困りごとを早く拾い上げて上長につなぐ。",
    responsibilities: [
      "チーム内の当日の業務調整(急な休み・追加訪問への対応)",
      "朝礼・申し送りの進行、情報共有",
      "メンバーの困りごとや体調の把握と主任・所長への報告",
      "新人・後輩への声かけと実務のフォロー",
      "担当委員会の活動、マニュアルの更新",
      "自らの担当業務・訪問の確実な実施",
    ].join("\n"),
    authority: "当日の業務の割り振りの調整(上長への事後報告)。",
    qualifications: "該当職種の資格(店舗の場合は実務経験)。当社での勤務経験1年以上が望ましい。",
    kpis: "個人の売上・訪問件数(店舗は売上)\nチームの記録・業務の期限遵守\n後輩の定着",
  },
  {
    id: "jd-staff",
    position: "スタッフ",
    reportsTo: "リーダー・主任・所長",
    mission: "専門職として利用者・家族に寄り添い、安全で質の高いサービスを提供する。チームの一員として報連相を徹底する。",
    responsibilities: [
      "担当利用者への訪問・サービスの提供",
      "記録・計画書・報告書の期限内の作成(iBow・カイポケ)",
      "利用者の状態変化の報告と、関係職種(医師・ケアマネ等)との連携",
      "感染対策・個人情報保護・安全運転などのルールの遵守",
      "アルコールチェック・運行記録などの日常業務の記録",
      "研修・委員会への参加と自己研鑽",
    ].join("\n"),
    authority: "担当業務の範囲内での判断。判断に迷う場合は上長へ相談する。",
    qualifications: "職種ごとの資格(看護師・療法士・介護支援専門員等)。普通自動車免許(訪問職)。",
    kpis: "個人の訪問件数・売上と目標達成率\n記録の期限内完了率\n研修への参加",
  },
];

/** 年度(4月始まり)の月リスト YYYY-MM */
export function fiscalMonths(fy: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((3 + i) % 12) + 1;
    const y = m >= 4 ? fy : fy + 1;
    return `${y}-${String(m).padStart(2, "0")}`;
  });
}

export function currentFiscalYear(date = new Date()): number {
  return date.getMonth() + 1 >= 4 ? date.getFullYear() : date.getFullYear() - 1;
}

/** 前月までの月(YYYY-MM)を新しい順に n か月分 */
function recentMonths(n: number): string[] {
  const list: string[] = [];
  const d = new Date();
  for (let i = 1; i <= n; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    list.push(toDateString(x).slice(0, 7));
  }
  return list;
}

// サンプルの数字(本物の数字ではない)。決まった値になるよう簡単な擬似乱数を使う。
function wobble(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 10000;
  return x - Math.floor(x) - 0.5; // -0.5〜0.5
}

export function sampleFinance(): FinanceMonthly[] {
  const base: Record<BusinessUnitId, { rev: number; target: number; labor: number; other: number }> = {
    houkan: { rev: 4800000, target: 5000000, labor: 0.68, other: 0.13 },
    kyotaku: { rev: 1300000, target: 1400000, labor: 0.8, other: 0.1 },
    uchinowa: { rev: 650000, target: 700000, labor: 0.45, other: 0.42 },
    uchiwell: { rev: 300000, target: 400000, labor: 0.5, other: 0.25 },
  };
  const out: FinanceMonthly[] = [];
  recentMonths(12).forEach((month, i) => {
    (Object.keys(base) as BusinessUnitId[]).forEach((unitId, j) => {
      const b = base[unitId];
      const rev = Math.round((b.rev * (1 - i * 0.012) * (1 + wobble(i * 7 + j) * 0.12)) / 1000) * 1000;
      out.push({
        id: `fin-${unitId}-${month}`,
        unitId,
        month,
        revenue: rev,
        revenueTarget: b.target,
        laborCost: Math.round((rev * (b.labor + wobble(i + j * 3) * 0.04)) / 1000) * 1000,
        otherCost: Math.round((rev * b.other) / 1000) * 1000,
        notes: "",
      });
    });
  });
  // 今年度の残りの月(今月以降)は目標だけ入れておく
  const thisMonth = toDateString(new Date()).slice(0, 7);
  for (const month of fiscalMonths(currentFiscalYear()).filter((m) => m >= thisMonth)) {
    (Object.keys(base) as BusinessUnitId[]).forEach((unitId) =>
      out.push({ id: `fin-${unitId}-${month}`, unitId, month, revenue: null, revenueTarget: base[unitId].target, laborCost: null, otherCost: null, notes: "" })
    );
  }
  return out;
}

export function sampleSubsidies(): Subsidy[] {
  return [
    { id: "sub-1", name: "(サンプル)介護職員等処遇改善加算", units: ["houkan", "kyotaku"], amount: 1200000, status: "入金済", appliedDate: daysAgo(200), receivedDate: daysAgo(120), notes: "" },
    { id: "sub-2", name: "(サンプル)IT導入補助金", units: [], amount: 500000, status: "申請中", appliedDate: daysAgo(30), receivedDate: "", notes: "" },
  ];
}

export function samplePersonalSales(): PersonalSales[] {
  const people: { staffId: string; rev: number; target: number; visits: number }[] = [
    { staffId: "s-ns1", rev: 1150000, target: 1200000, visits: 95 },
    { staffId: "s-ns2", rev: 980000, target: 1100000, visits: 82 },
    { staffId: "s-pt1", rev: 900000, target: 950000, visits: 105 },
    { staffId: "s-cm1", rev: 520000, target: 550000, visits: 38 },
    { staffId: "s-cm2", rev: 470000, target: 500000, visits: 35 },
  ];
  const out: PersonalSales[] = [];
  recentMonths(6).forEach((month, i) =>
    people.forEach((p, j) => {
      const f = 1 + wobble(i * 5 + j * 11) * 0.15;
      out.push({
        id: `ps-${p.staffId}-${month}`,
        staffId: p.staffId,
        month,
        revenue: Math.round((p.rev * f) / 1000) * 1000,
        target: p.target,
        visits: Math.round(p.visits * f),
      });
    })
  );
  return out;
}

export function sampleNanbyo(): { patients: NanbyoPatient[]; entries: NanbyoEntry[] } {
  const thisMonth = toDateString(new Date()).slice(0, 7);
  return {
    patients: [
      {
        id: "nb-1",
        name: "(サンプル)A.K 様",
        unitId: "houkan",
        recipientNumber: "",
        validFrom: `${thisMonth.slice(0, 4)}-01-01`,
        validTo: `${thisMonth.slice(0, 4)}-12-31`,
        monthlyCap: 10000,
        burdenRate: 0.2,
        notes: "",
        active: true,
      },
    ],
    entries: [
      { id: "nbe-1", patientId: "nb-1", date: `${thisMonth}-02`, provider: "○○病院", totalCost: 30000, copay: 6000, createdAt: `${thisMonth}-02T10:00:00` },
    ],
  };
}

export function sampleSalesActivities(): SalesActivity[] {
  return [
    {
      id: "sa-1",
      date: daysAgo(3),
      staffId: "s-admin",
      unitId: "houkan",
      orgName: "(サンプル)○○総合病院 地域連携室",
      orgType: "病院(地域連携室)",
      contactPerson: "MSW 担当者",
      method: "訪問",
      content: "パンフレットを持参。退院支援の対象者について情報交換。",
      result: "依頼あり",
      referrals: 1,
      nextAction: "退院前カンファレンスに参加",
      nextDate: daysAgo(-4),
      createdAt: `${daysAgo(3)}T15:00:00`,
    },
  ];
}

export function sampleGoals(): Goal[] {
  const month = toDateString(new Date()).slice(0, 7);
  const now = `${toDateString(new Date())}T09:00:00`;
  const base = { note: "", updatedAt: now };
  return [
    { ...base, id: "g-1", scope: "personal", staffId: "s-ns1", unitId: "houkan", period: month, title: "訪問件数 月95件", category: "訪問・件数", targetValue: 95, currentValue: 60, valueUnit: "件", status: "進行中" },
    { ...base, id: "g-2", scope: "personal", staffId: "s-ns1", unitId: "houkan", period: month, title: "新人の同行訪問を4回行う", category: "研修・教育", targetValue: 4, currentValue: 2, valueUnit: "回", status: "進行中" },
    { ...base, id: "g-3", scope: "personal", staffId: "s-admin", unitId: "houkan", period: month, title: "病院の地域連携室への営業 8件", category: "新規獲得", targetValue: 8, currentValue: 3, valueUnit: "件", status: "進行中" },
    { ...base, id: "g-4", scope: "unit", staffId: "", unitId: "houkan", period: month, title: "新規利用者 5名", category: "新規獲得", targetValue: 5, currentValue: 2, valueUnit: "名", status: "進行中" },
    { ...base, id: "g-5", scope: "unit", staffId: "", unitId: "kyotaku", period: month, title: "担当件数 1人あたり38件", category: "訪問・件数", targetValue: 38, currentValue: 35, valueUnit: "件", status: "進行中" },
  ];
}

/** 目標管理シートの原本(事業所ごと)。今は訪問看護のみ */
export const DEFAULT_GOAL_SHEET_TEMPLATES: Partial<Record<BusinessUnitId, string>> = {
  houkan: "https://docs.google.com/spreadsheets/d/1tL4ed9Z_JWmFwA1qJ-ARWQ1cOBKI4hQvtFd7Ep0bjII/edit",
};

/** 書類の保存先(ルートフォルダ)の初期値: Googleドライブ「Uchi care全体共有」 */
export const DEFAULT_DRIVE_ROOT_FOLDER_ID = "1GDxEcuPi_xrEl4iBaiiAlFtOYUo1g6gW";
