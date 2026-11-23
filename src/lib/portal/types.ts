/** 事業所(事業部門) */
export type BusinessUnitId = "houkan" | "kyotaku" | "uchinowa" | "uchiwell";

export interface BusinessUnit {
  id: BusinessUnitId;
  name: string;
  shortName: string;
  /** Tailwind のカラークラス(バッジ表示用) */
  badgeClass: string;
}

export type LinkCategory =
  | "カルテ"
  | "スケジュール"
  | "勤怠"
  | "書類管理"
  | "名刺"
  | "連携・コミュニケーション"
  | "福利厚生"
  | "研修・eラーニング"
  | "マニュアル"
  | "店舗・レジ"
  | "デザイン"
  | "その他";

export interface ExternalLink {
  id: string;
  name: string;
  description: string;
  category: LinkCategory;
  /** 空文字の場合は「URL未設定」として表示する(appUrl があればそちらを開く) */
  url: string;
  /** スマートフォンアプリ(App Store 等)のURL */
  appUrl?: string;
  icon: string;
  units: BusinessUnitId[];
}

export type StaffRole =
  | "管理者"
  | "看護師"
  | "准看護師"
  | "理学療法士"
  | "作業療法士"
  | "言語聴覚士"
  | "ケアマネジャー"
  | "事務"
  | "店舗スタッフ"
  | "その他";

/** 役職の分類(職務記述書と閲覧権限に使う) */
export type Position = "経営者" | "統括部長" | "管理者" | "責任者" | "主任" | "一般スタッフ";

/** 以前の役職名(保存済みデータの移行用) */
export type LegacyPosition = "所長" | "リハ責任者" | "事務長" | "リーダー" | "スタッフ";

export interface Staff {
  id: string;
  name: string;
  unitId: BusinessUnitId;
  /** 職種 */
  role: StaffRole;
  /** 役職 */
  position: Position;
  /** 社用車を運転する */
  isDriver: boolean;
  /** 安全運転管理者(またはその代行者)としてアルコールチェックの確認者になれる */
  isSafetyManager: boolean;
  /** 人事評価の評価者になれる */
  isEvaluator: boolean;
  active: boolean;
}

export type VehicleOwnership = "自社所有" | "リース" | "その他";

export interface Vehicle {
  id: string;
  name: string;
  /** 自動車登録番号 */
  plate: string;
  unitId: BusinessUnitId;
  active: boolean;
  /** 車種・色など */
  model?: string;
  ownership?: VehicleOwnership;
  /** リース会社・購入先 */
  leaseCompany?: string;
  leaseEnd?: string;
  /** 車検満了日 */
  inspectionDue?: string;
  /** 自賠責保険の期限 */
  compulsoryInsuranceEnd?: string;
  /** 任意保険の期限 */
  voluntaryInsuranceEnd?: string;
  insuranceCompany?: string;
  notes?: string;
}

/** 運行管理表(運転日報) */
export interface VehicleLog {
  id: string;
  date: string; // YYYY-MM-DD
  vehicleId: string;
  driverId: string;
  startTime: string; // HH:mm
  endTime: string;
  startOdometer: number | null;
  endOdometer: number | null;
  destinations: string;
  purpose: string;
  refuelLiters: number | null;
  notes: string;
  createdAt: string;
}

export type AlcoholCheckTiming = "before" | "after";
export type AlcoholCheckMethod = "対面" | "ビデオ通話" | "電話" | "その他";

/** アルコールチェック記録 */
export interface AlcoholCheck {
  id: string;
  date: string;
  time: string;
  driverId: string;
  vehicleId: string;
  timing: AlcoholCheckTiming;
  method: AlcoholCheckMethod;
  detectorUsed: boolean;
  /** 呼気中アルコール濃度 (mg/L) */
  value: number;
  checkerId: string;
  instructions: string;
  notes: string;
  createdAt: string;
}

export type NoticeCategory = "お知らせ" | "重要" | "研修" | "行事" | "規程・制度" | "システム";

export interface Notice {
  id: string;
  title: string;
  body: string;
  category: NoticeCategory;
  /** 空配列 = 全社向け */
  units: BusinessUnitId[];
  pinned: boolean;
  authorId: string;
  /** 関連資料(Googleドキュメント等)のURL */
  linkUrl: string;
  createdAt: string;
  readBy: string[];
}

export interface Committee {
  id: string;
  name: string;
  units: BusinessUnitId[];
  /** 開催頻度の目安(◯ヶ月に1回)。0 = 定めなし */
  frequencyMonths: number;
  description: string;
}

/** 委員会議事録 */
export interface Minutes {
  id: string;
  committeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  place: string;
  attendeeIds: string[];
  /** 社外参加者など、スタッフ以外の出席者 */
  otherAttendees: string;
  recorderId: string;
  agenda: string;
  discussion: string;
  decisions: string;
  nextDate: string;
  attachmentUrl: string;
  /** AIによる要約 */
  summary?: string;
  /** 録音の文字起こし */
  transcript?: string;
  /** Googleドライブに保存した添付ファイル(資料・録音) */
  attachments?: DriveFileRef[];
  /** Googleドキュメントとして保存した議事録 */
  driveDocUrl?: string;
  createdAt: string;
}

export interface DriveFileRef {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
}

export interface EvaluationCriterion {
  id: string;
  name: string;
  description: string;
}

export interface EvaluationScore {
  self: number | null;
  evaluator: number | null;
  comment: string;
}

export type EvaluationStatus = "draft" | "selfDone" | "completed";

/** 人事評価表 */
export interface Evaluation {
  id: string;
  staffId: string;
  evaluatorId: string;
  period: string;
  scores: Record<string, EvaluationScore>;
  goals: string;
  selfComment: string;
  evaluatorComment: string;
  status: EvaluationStatus;
  updatedAt: string;
}

export type ParkingOwnership = "自社所有" | "賃貸(月極)" | "その他";

/** 自社が保有・契約している駐車場 */
export interface ParkingLot {
  id: string;
  name: string;
  unitId: BusinessUnitId;
  address: string;
  /** Googleマップ等のURL(空なら住所から検索リンクを作る) */
  mapUrl: string;
  ownership: ParkingOwnership;
  /** 貸主・管理会社 */
  contractor: string;
  contact: string;
  /** 月額(円)。自社所有なら null */
  monthlyFee: number | null;
  /** 契約期限・更新日 */
  contractEnd: string;
  notes: string;
}

export type ParkingUsage = "社用車" | "職員通勤" | "来客用" | "予備";

/** 駐車場の区画 */
export interface ParkingSpace {
  id: string;
  lotId: string;
  label: string;
  usage: ParkingUsage;
  /** 社用車の区画に割り当てる車両 */
  vehicleId: string;
  /** 職員通勤の区画に割り当てる職員 */
  staffId: string;
  /** 職員の自家用車ナンバー */
  staffCarPlate: string;
  /** 来客用・予備区画の一時使用者(空なら空き) */
  occupiedBy: string;
  occupiedUntil: string;
  notes: string;
}

/** 職務記述書(ジョブディスクリプション) */
export interface JobDescription {
  id: string;
  position: Position;
  reportsTo: string;
  mission: string;
  /** 1行1項目 */
  responsibilities: string;
  authority: string;
  qualifications: string;
  kpis: string;
}

/** 難病(特定医療費)受給者 */
export interface NanbyoPatient {
  id: string;
  /** 表示名(個人情報保護のためイニシャルや利用者番号を推奨) */
  name: string;
  unitId: BusinessUnitId;
  recipientNumber: string;
  validFrom: string;
  validTo: string;
  /** 月額自己負担上限額(円) */
  monthlyCap: number;
  /** 負担割合(0.2 = 2割) */
  burdenRate: number;
  notes: string;
  active: boolean;
}

/** 自己負担上限額管理票への記載(1回分) */
export interface NanbyoEntry {
  id: string;
  patientId: string;
  date: string;
  /** 記載した医療機関等(当ステーション・病院・薬局など) */
  provider: string;
  /** 医療費総額(10割) */
  totalCost: number;
  /** 徴収した自己負担額 */
  copay: number;
  createdAt: string;
}

export type SalesOrgType = "病院(地域連携室)" | "診療所・クリニック" | "居宅介護支援事業所" | "地域包括支援センター" | "訪問看護・介護事業所" | "行政" | "その他";
export type SalesMethod = "訪問" | "電話" | "オンライン" | "メール・FAX" | "その他";
export type SalesResult = "情報提供" | "依頼あり" | "検討中" | "関係構築" | "その他";

/** 営業活動の記録 */
export interface SalesActivity {
  id: string;
  date: string;
  staffId: string;
  unitId: BusinessUnitId;
  orgName: string;
  orgType: SalesOrgType;
  contactPerson: string;
  method: SalesMethod;
  content: string;
  result: SalesResult;
  /** 新規の紹介・依頼件数 */
  referrals: number;
  nextAction: string;
  nextDate: string;
  createdAt: string;
}

/** 事業所の月次の数字 */
export interface FinanceMonthly {
  id: string;
  unitId: BusinessUnitId;
  month: string; // YYYY-MM
  revenue: number | null;
  revenueTarget: number | null;
  laborCost: number | null;
  otherCost: number | null;
  notes: string;
}

export type SubsidyStatus = "申請予定" | "申請中" | "採択・交付決定" | "入金済" | "不採択";

export interface Subsidy {
  id: string;
  name: string;
  units: BusinessUnitId[];
  amount: number;
  status: SubsidyStatus;
  appliedDate: string;
  receivedDate: string;
  notes: string;
}

/** 個人の月次の売上と目標 */
export interface PersonalSales {
  id: string;
  staffId: string;
  month: string;
  revenue: number | null;
  target: number | null;
  visits: number | null;
}

export type GoalCategory = "売上" | "訪問・件数" | "新規獲得" | "スキル・資格" | "業務改善" | "研修・教育" | "その他";
export type GoalStatus = "未着手" | "進行中" | "達成" | "未達";

/** 目標(個人・部門) */
export interface Goal {
  id: string;
  scope: "personal" | "unit";
  /** 個人目標の本人(部門目標は空) */
  staffId: string;
  unitId: BusinessUnitId;
  /** 対象期間: 月("2026-11")または半期("2026年度 下期") */
  period: string;
  title: string;
  category: GoalCategory;
  /** 数値目標(任意) */
  targetValue: number | null;
  currentValue: number | null;
  /** 単位(件・円・回・% など) */
  valueUnit: string;
  status: GoalStatus;
  note: string;
  updatedAt: string;
}

/** 目標管理シート(Googleスプレッドシート)から読み込んだ進捗 */
export interface GoalSheetSync {
  sheetStaffName: string;
  cdpStage: string;
  self6: string;
  mentor6: string;
  self1y: string;
  mentor1y: string;
  /** 0〜1 */
  selfProgress: number | null;
  mentorProgress: number | null;
  selfAvg: string;
  mentorAvg: string;
  syncedAt: string;
}

/** 職員ごとの目標管理シート(原本をコピーしたもの) */
export interface GoalSheet {
  id: string;
  staffId: string;
  fiscalYear: number;
  fileId: string;
  url: string;
  name: string;
  sync?: GoalSheetSync;
}

/** 会社の理念(ホームの見出しに表示) */
export interface CompanyPhilosophy {
  mission: string;
  missionEn: string;
  vision: string;
  visionEn: string;
  /** 1行1項目 */
  values: string;
}

/** 相談窓口の設定 */
export interface ConsultationDesk {
  id: string;
  name: string;
  /** 担当者名 */
  owner: string;
  /** 相談を届けるメールアドレス */
  email: string;
  /** 電話で相談する場合の番号 */
  phone?: string;
  /** Googleフォームで受け付ける場合のURL(匿名相談向け) */
  formUrl: string;
  description: string;
  icon: string;
}

export type SalesSource = "ZEST" | "iBow" | "その他";

/** 日次の売上(ZEST・iBow等のデータを取り込んだもの。日付×職員で集計) */
export interface DailySale {
  id: string;
  date: string; // YYYY-MM-DD
  /** 未割当(職員と結びつかなかった行)は空 */
  staffId: string;
  /** 取り込み元ファイルでの担当者名 */
  rawName: string;
  amount: number;
  visits: number;
  source: SalesSource;
  importedAt: string;
}

/** 取り込み設定(どの列を何として読むか)。取り込み元ごとに保存して毎日使い回す */
export interface SalesImportMapping {
  dateCol: string;
  staffCol: string;
  amountCol: string;
  /** 空なら1行=1件として数える */
  visitsCol: string;
  /** 金額列が「単位数」の場合の1単位あたりの円(円の場合は1) */
  unitPrice: number;
  /** ファイル上の担当者名 → 職員ID */
  staffAliases: Record<string, string>;
}

/** 報酬単価(訪問件数から売上を概算するための表) */
export interface FeeRate {
  /** key と同じ値 */
  id: string;
  /** `${区分}|${サービス名(NFKC正規化)}` */
  key: string;
  group: string;
  code: string;
  /** 単位=介護保険の単位数(×地域単価) / 円=医療保険の療養費など */
  kind: "単位" | "円";
  value: number;
  /**
   * 「件数[n]」の [n] の扱い
   * billing: 請求回数として使う(介護 訪看Ⅰ5 の20分ごとの回数)
   * exclude: 件数から差し引く(医療・精神 難病等複数回訪問等で基本療養費が発生しない回数)
   * none: 使わない
   */
  bracketMode: "billing" | "exclude" | "none";
  note: string;
}
