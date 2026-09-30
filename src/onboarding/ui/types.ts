/** APIレスポンスの型(画面用) */

export type HireRow = {
  id: number; name: string; name_romaji: string; job_type_id: number | null; job_type_name: string | null;
  department_id: number; department_name: string; department_code: string; office_id: number | null; office_name: string | null;
  start_date: string; prep_deadline: string | null; preparer_id: number | null; preparer_name: string | null;
  deputy_id: number | null; deputy_name: string | null; checker_id: number | null; checker_name: string | null;
  status: string; ready_at: string | null; confirmed_at: string | null; confirmed_by_name: string | null; confirm_note: string | null;
  lent_date: string | null; lent_by_name: string | null; explanation_note: string | null;
};

export type TaskRow = {
  id: number; template_code: string | null; template_version: number; template_current_version: number | null; sort_no: number;
  title: string; requirement: string; assignee_id: number | null; assignee_name: string | null; due_date: string | null;
  status: string; na_reason: string | null; device_check: string; completion_mode: string; owner_mode: string;
  iphone_checked_at: string | null; ipad_checked_at: string | null; completed_at: string | null; completed_by_name: string | null;
};

export type HireServiceRow = {
  id: number; service_id: number; name: string; code: string; requirement: string; usage_decision: string | null;
  placement: string; placement_confirmed: number; url: string | null; app_store_url: string | null; account_type: string;
  account_note: string | null; needs_issuance: number; iphone_target: number; ipad_target: number;
  iphone_placed_at: string | null; ipad_placed_at: string | null; iphone_login_at: string | null; ipad_login_at: string | null;
  verified_at: string | null; note: string | null;
};

export type RequestRow = {
  id: number; service_id: number; service_name: string; status: string; desired_date: string | null; requested_to: string | null;
  requested_at: string | null; requested_by_name: string | null; request_method: string | null; issued_at: string | null;
  issued_login_id: string | null; login_confirmed_at: string | null; requires_email: number; issuer_label: string | null;
  issuer_name: string | null; issuer_deputy_name: string | null; owner_mode: string; issuer_user_id: number | null;
  deputy_user_id: number | null; note: string | null;
};

export type AppleRow = {
  id: number; number: number; planned_email: string; actual_email: string | null; status: string; reserved_at: string;
  reserved_by_name: string | null; failure_reason: string | null; cancel_reason: string | null; note: string | null;
  created_recorded_at: string | null; reuse_approved_at: string | null;
};

export type DeviceRow = {
  id: number; asset_no: string; kind: string; model: string | null; serial: string | null; phone_number: string | null;
  auth_code_destination: string | null; auth_manager_name: string | null; lend_status: string; lent_date: string | null;
  apple_actual_email: string | null; apple_planned_email: string | null; passcode_ref?: string | null;
};

export type HistoryRow = { at: string; user_name: string; action: string; entity?: string; detail: string | null };

export type HireDetail = {
  hire: HireRow;
  tasks: TaskRow[];
  services: HireServiceRow[];
  requests: RequestRow[];
  apple: AppleRow[];
  activeApple: AppleRow | null;
  confirmedEmail: string | null;
  devices: DeviceRow[];
  credentials: { id: number; label: string; ref_location: string; created_at: string; created_by_name: string | null }[] | null;
  history: HistoryRow[];
  progress: { required_total: number; required_done: number; required_rate: number; optional_total: number; optional_done: number; overdue: number };
  blockers: string[];
  openItems: { kind: string; title: string; assignee: string | null; due: string | null; overdue: boolean; requirement: string }[];
  perms: { canPrepare: boolean; canAdmin: boolean; canViewCredentials: boolean };
};
