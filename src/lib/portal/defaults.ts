import {
  AlcoholCheck,
  BusinessUnit,
  BusinessUnitId,
  Committee,
  EvaluationCriterion,
  ExternalLink,
  Minutes,
  Notice,
  ParkingLot,
  ParkingSpace,
  Staff,
  Vehicle,
  VehicleLog,
} from "./types";
import { daysAgo } from "./util";

export const BUSINESS_UNITS: BusinessUnit[] = [
  { id: "houkan", name: "訪問看護", shortName: "訪看", badgeClass: "bg-teal-50 text-teal-700 ring-teal-200" },
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
  { id: "ibow", name: "iBow", description: "訪問看護 電子カルテ", category: "カルテ", url: "https://ewellibow.jp/", icon: "🩺", units: ["houkan"] },
  { id: "kaipoke", name: "カイポケ", description: "居宅介護支援 カルテ・請求", category: "カルテ", url: "https://kaipoke.biz/", icon: "📋", units: ["kyotaku"] },
  { id: "zest", name: "ZEST(ゼスト)", description: "訪問スケジュール管理", category: "スケジュール", url: "https://zest.jp/", icon: "🗓️", units: CARE },
  { id: "kingoftime", name: "KING OF TIME", description: "勤怠管理(打刻・休暇申請)", category: "勤怠", url: "https://www.kingoftime.jp/", icon: "⏰", units: ["houkan", "kyotaku", "uchinowa", "uchiwell"] },
  { id: "gdrive", name: "Googleドライブ", description: "共有フォルダ・書類保管", category: "書類管理", url: "https://drive.google.com/", icon: "📁", units: ["houkan", "kyotaku", "uchiwell"] },
  { id: "gsheets", name: "Googleスプレッドシート", description: "各種管理表", category: "書類管理", url: "https://docs.google.com/spreadsheets/", icon: "📊", units: ["houkan", "kyotaku", "uchiwell"] },
  { id: "gdocs", name: "Googleドキュメント", description: "文書・マニュアル", category: "書類管理", url: "https://docs.google.com/document/", icon: "📄", units: ["houkan", "kyotaku", "uchiwell"] },
  { id: "gslides", name: "Googleスライド", description: "研修資料・プレゼン", category: "書類管理", url: "https://docs.google.com/presentation/", icon: "🖼️", units: ["houkan", "kyotaku", "uchiwell"] },
  { id: "gforms", name: "Googleフォーム", description: "アンケート・申請フォーム", category: "書類管理", url: "https://docs.google.com/forms/", icon: "📝", units: ["houkan", "kyotaku", "uchiwell"] },
  { id: "mybridge", name: "myBridge", description: "名刺管理", category: "名刺", url: "https://mybridge.com/", icon: "📇", units: CARE },
  { id: "mcs", name: "MCS", description: "医療介護専用SNS(多職種連携)", category: "連携・コミュニケーション", url: "https://www.medical-care.net/", icon: "🤝", units: CARE },
  { id: "lineworks", name: "LINE WORKS", description: "社内チャット・連絡", category: "連携・コミュニケーション", url: "https://line-works.com/", icon: "💬", units: ["houkan", "kyotaku", "uchiwell"] },
  { id: "enursing", name: "e-nursing 福利厚生", description: "福利厚生サービス", category: "福利厚生", url: "", icon: "🎁", units: CARE },
  { id: "airregi", name: "Airレジ", description: "POSレジ・売上管理", category: "店舗・レジ", url: "https://airregi.jp/", icon: "🧾", units: ["uchinowa"] },
  { id: "canva", name: "Canva", description: "チラシ・SNS画像作成", category: "デザイン", url: "https://www.canva.com/", icon: "🎨", units: ["uchinowa"] },
];

export const DEFAULT_STAFF: Staff[] = [
  { id: "s-admin", name: "管理者(本部)", unitId: "houkan", role: "管理者", isDriver: true, isSafetyManager: true, isEvaluator: true, active: true },
  { id: "s-ns1", name: "看護師A", unitId: "houkan", role: "看護師", isDriver: true, isSafetyManager: false, isEvaluator: false, active: true },
  { id: "s-ns2", name: "看護師B", unitId: "houkan", role: "看護師", isDriver: true, isSafetyManager: false, isEvaluator: false, active: true },
  { id: "s-pt1", name: "理学療法士A", unitId: "houkan", role: "理学療法士", isDriver: true, isSafetyManager: false, isEvaluator: false, active: true },
  { id: "s-cm1", name: "ケアマネジャーA", unitId: "kyotaku", role: "ケアマネジャー", isDriver: true, isSafetyManager: true, isEvaluator: true, active: true },
  { id: "s-cm2", name: "ケアマネジャーB", unitId: "kyotaku", role: "ケアマネジャー", isDriver: true, isSafetyManager: false, isEvaluator: false, active: true },
  { id: "s-shop1", name: "店舗スタッフA", unitId: "uchinowa", role: "店舗スタッフ", isDriver: false, isSafetyManager: false, isEvaluator: false, active: true },
  { id: "s-well1", name: "Uchi Wellスタッフ", unitId: "uchiwell", role: "その他", isDriver: false, isSafetyManager: false, isEvaluator: false, active: true },
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
