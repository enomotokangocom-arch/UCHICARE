/** 画面・サーバー共通の表示ラベルと定数 */

export type Role = "admin" | "preparer" | "issuer" | "viewer";
export const ROLE_LABELS: Record<Role, string> = {
  admin: "管理者",
  preparer: "準備担当者",
  issuer: "事務・発行責任者",
  viewer: "閲覧者",
};

export type TaskStatus = "todo" | "doing" | "waiting_issue" | "waiting_check" | "done" | "na";
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "未着手",
  doing: "進行中",
  waiting_issue: "発行待ち",
  waiting_check: "確認待ち",
  done: "完了",
  na: "対象外",
};
export const TASK_STATUSES = Object.keys(TASK_STATUS_LABELS) as TaskStatus[];
export const OPEN_STATUSES: TaskStatus[] = ["todo", "doing", "waiting_issue", "waiting_check"];

export type HireStatus = "preparing" | "ready" | "confirmed" | "lent";
export const HIRE_STATUS_LABELS: Record<HireStatus, string> = {
  preparing: "準備中",
  ready: "準備完了(確認待ち)",
  confirmed: "管理者確認済み",
  lent: "貸与済み",
};

export type Requirement = "required" | "optional" | "excluded" | "confirm";
export const REQUIREMENT_LABELS: Record<Requirement, string> = {
  required: "必須",
  optional: "任意",
  excluded: "対象外",
  confirm: "利用要否の確認",
};

export type Placement = "app" | "web" | "app_web" | "unset";
export const PLACEMENT_LABELS: Record<Placement, string> = {
  app: "アプリ",
  web: "Web(ホーム画面に追加)",
  app_web: "アプリ+Web",
  unset: "未設定",
};

export type AccountType = "individual_email" | "company_google" | "individual" | "none" | "unset";
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  individual_email: "確定メールアドレスで個別発行",
  company_google: "会社Googleアカウントを使用",
  individual: "個別アカウント(発行が必要)",
  none: "アカウント不要",
  unset: "未設定",
};

export type OwnerMode = "enomoto" | "transferred" | "unset";
export const OWNER_MODE_LABELS: Record<OwnerMode, string> = {
  enomoto: "榎本への依頼が必要",
  transferred: "移管済み",
  unset: "未設定",
};

export type AppleStatus = "reserved" | "created" | "cancelled" | "unusable";
export const APPLE_STATUS_LABELS: Record<AppleStatus, string> = {
  reserved: "予約中(未作成)",
  created: "作成済み",
  cancelled: "取消",
  unusable: "使用不可",
};

export type RequestStatus = "not_requested" | "requested" | "issued" | "login_confirmed" | "cancelled";
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  not_requested: "未依頼",
  requested: "依頼済み(発行待ち)",
  issued: "発行済み(ログイン未確認)",
  login_confirmed: "ログイン確認済み",
  cancelled: "取消",
};

export type LendStatus = "stock" | "assigned" | "lent" | "returned" | "repair";
export const LEND_STATUS_LABELS: Record<LendStatus, string> = {
  stock: "在庫",
  assigned: "割当済み(準備中)",
  lent: "貸与中",
  returned: "返却済み",
  repair: "修理・使用不可",
};

export function pad3(n: number): string {
  return String(n).padStart(3, "0");
}
