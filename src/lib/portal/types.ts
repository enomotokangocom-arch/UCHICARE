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
  | "店舗・レジ"
  | "デザイン"
  | "その他";

export interface ExternalLink {
  id: string;
  name: string;
  description: string;
  category: LinkCategory;
  /** 空文字の場合は「URL未設定」として表示する */
  url: string;
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

export interface Staff {
  id: string;
  name: string;
  unitId: BusinessUnitId;
  role: StaffRole;
  /** 社用車を運転する */
  isDriver: boolean;
  /** 安全運転管理者(またはその代行者)としてアルコールチェックの確認者になれる */
  isSafetyManager: boolean;
  /** 人事評価の評価者になれる */
  isEvaluator: boolean;
  active: boolean;
}

export interface Vehicle {
  id: string;
  name: string;
  /** 自動車登録番号 */
  plate: string;
  unitId: BusinessUnitId;
  active: boolean;
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
  createdAt: string;
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
