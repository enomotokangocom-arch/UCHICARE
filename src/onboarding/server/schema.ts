/**
 * データベーススキーマ。
 *
 * 認証情報(パスワード・端末パスコード)の実値を保存する列は存在しません。
 * 保存するのは「どこに保管されているか」という参照先(credential_ref)のみです。
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT,
  updated_by INTEGER
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','preparer','issuer','viewer')),
  is_representative INTEGER NOT NULL DEFAULT 0,
  scope_office_ids TEXT NOT NULL DEFAULT '[]',
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS offices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  department_id INTEGER REFERENCES departments(id),
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS job_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  -- app / web / app_web / unset
  placement TEXT NOT NULL DEFAULT 'unset',
  -- 会社として正しいアプリ・URL・配置方式が確定しているか
  placement_confirmed INTEGER NOT NULL DEFAULT 0,
  url TEXT,
  app_store_url TEXT,
  -- individual_email(確定メールで個別発行) / company_google(会社Googleアカウント) / individual(個別アカウント) / none / unset
  account_type TEXT NOT NULL DEFAULT 'unset',
  account_note TEXT,
  -- 個別のアカウント発行(依頼)が必要か
  needs_issuance INTEGER NOT NULL DEFAULT 0,
  -- 発行依頼に確定メールアドレスが必要か
  requires_email INTEGER NOT NULL DEFAULT 0,
  issuer_label TEXT,
  issuer_user_id INTEGER REFERENCES users(id),
  deputy_user_id INTEGER REFERENCES users(id),
  -- enomoto(榎本への依頼が必要) / transferred(移管済み) / unset
  owner_mode TEXT NOT NULL DEFAULT 'unset',
  procedure TEXT,
  completion_criteria TEXT,
  standard_days INTEGER,
  credential_ref TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT,
  updated_by INTEGER
);

CREATE TABLE IF NOT EXISTS department_services (
  department_id INTEGER NOT NULL REFERENCES departments(id),
  service_id INTEGER NOT NULL REFERENCES services(id),
  -- required / optional / excluded / confirm(利用要否の確認)
  requirement TEXT NOT NULL CHECK (requirement IN ('required','optional','excluded','confirm')),
  PRIMARY KEY (department_id, service_id)
);

CREATE TABLE IF NOT EXISTS task_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  sort_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  -- preparer / checker / fixed_user
  assignee_type TEXT NOT NULL DEFAULT 'preparer',
  fixed_user_id INTEGER REFERENCES users(id),
  requirement TEXT NOT NULL DEFAULT 'required' CHECK (requirement IN ('required','optional')),
  prerequisites TEXT NOT NULL DEFAULT '[]',
  procedure TEXT NOT NULL DEFAULT '',
  completion_criteria TEXT NOT NULL DEFAULT '',
  related_urls TEXT NOT NULL DEFAULT '',
  account_info TEXT NOT NULL DEFAULT '',
  -- none / both(iPhone・iPadそれぞれ確認)
  device_check TEXT NOT NULL DEFAULT 'none',
  due_offset_days INTEGER NOT NULL DEFAULT -7,
  -- system: 自動判定で完了する作業(管理者確認・貸与)
  completion_mode TEXT NOT NULL DEFAULT 'manual',
  owner_mode TEXT NOT NULL DEFAULT 'transferred',
  -- 条件付き生成(例: 配置方式が未確定のサービスがある場合のみ)
  condition TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT,
  updated_by INTEGER
);

CREATE TABLE IF NOT EXISTS template_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES task_templates(id),
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  summary TEXT,
  changed_at TEXT NOT NULL,
  changed_by INTEGER,
  UNIQUE (template_id, version)
);

CREATE TABLE IF NOT EXISTS apple_numbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number INTEGER NOT NULL UNIQUE,
  planned_email TEXT NOT NULL UNIQUE,
  actual_email TEXT UNIQUE,
  -- reserved(予約中) / created(作成済み) / cancelled(取消) / unusable(使用不可)
  status TEXT NOT NULL CHECK (status IN ('reserved','created','cancelled','unusable')),
  hire_id INTEGER REFERENCES hires(id),
  reserved_by INTEGER REFERENCES users(id),
  reserved_at TEXT NOT NULL,
  created_recorded_by INTEGER,
  created_recorded_at TEXT,
  failure_reason TEXT,
  cancel_reason TEXT,
  cancelled_by INTEGER,
  cancelled_at TEXT,
  reuse_approved_by INTEGER,
  reuse_approved_at TEXT,
  -- 入職者として登録していない既存職員のアカウント(一括登録分)の利用者名・所属など
  holder_name TEXT,
  holder_note TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS hires (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_romaji TEXT NOT NULL,
  job_type_id INTEGER REFERENCES job_types(id),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  office_id INTEGER REFERENCES offices(id),
  start_date TEXT NOT NULL,
  prep_deadline TEXT,
  preparer_id INTEGER REFERENCES users(id),
  deputy_id INTEGER REFERENCES users(id),
  checker_id INTEGER REFERENCES users(id),
  -- preparing / ready(準備完了) / confirmed(管理者確認済み) / lent(貸与済み)
  status TEXT NOT NULL DEFAULT 'preparing',
  ready_at TEXT, ready_by INTEGER,
  confirmed_at TEXT, confirmed_by INTEGER, confirm_note TEXT,
  lent_date TEXT, lent_by INTEGER, explanation_note TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  created_by INTEGER
);

CREATE TABLE IF NOT EXISTS hire_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hire_id INTEGER NOT NULL REFERENCES hires(id),
  template_id INTEGER REFERENCES task_templates(id),
  template_code TEXT,
  template_version INTEGER,
  sort_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  requirement TEXT NOT NULL,
  assignee_id INTEGER REFERENCES users(id),
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo','doing','waiting_issue','waiting_check','done','na')),
  na_reason TEXT,
  prerequisites TEXT NOT NULL DEFAULT '[]',
  procedure TEXT NOT NULL DEFAULT '',
  completion_criteria TEXT NOT NULL DEFAULT '',
  related_urls TEXT NOT NULL DEFAULT '',
  account_info TEXT NOT NULL DEFAULT '',
  device_check TEXT NOT NULL DEFAULT 'none',
  completion_mode TEXT NOT NULL DEFAULT 'manual',
  owner_mode TEXT NOT NULL DEFAULT 'transferred',
  iphone_checked_at TEXT, iphone_checked_by INTEGER,
  ipad_checked_at TEXT, ipad_checked_by INTEGER,
  completed_at TEXT, completed_by INTEGER,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS task_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES hire_tasks(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hire_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hire_id INTEGER NOT NULL REFERENCES hires(id),
  service_id INTEGER NOT NULL REFERENCES services(id),
  requirement TEXT NOT NULL,
  -- 利用要否の確認: pending / use / not_use
  usage_decision TEXT,
  iphone_target INTEGER NOT NULL DEFAULT 1,
  ipad_target INTEGER NOT NULL DEFAULT 1,
  iphone_placed_at TEXT, ipad_placed_at TEXT,
  iphone_login_at TEXT, iphone_login_by INTEGER,
  ipad_login_at TEXT, ipad_login_by INTEGER,
  verified_at TEXT, verified_by INTEGER,
  note TEXT,
  UNIQUE (hire_id, service_id)
);

CREATE TABLE IF NOT EXISTS account_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hire_id INTEGER NOT NULL REFERENCES hires(id),
  service_id INTEGER NOT NULL REFERENCES services(id),
  -- not_requested / requested / issued / login_confirmed / cancelled
  status TEXT NOT NULL DEFAULT 'not_requested',
  desired_date TEXT,
  requested_to TEXT,
  requested_at TEXT, requested_by INTEGER, request_method TEXT,
  issued_at TEXT, issued_by INTEGER, issued_login_id TEXT,
  login_confirmed_at TEXT, login_confirmed_by INTEGER,
  note TEXT,
  UNIQUE (hire_id, service_id)
);

CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_no TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('iPhone','iPad')),
  model TEXT,
  serial TEXT UNIQUE,
  phone_number TEXT,
  hire_id INTEGER REFERENCES hires(id),
  office_id INTEGER REFERENCES offices(id),
  apple_number_id INTEGER REFERENCES apple_numbers(id),
  auth_code_destination TEXT,
  auth_manager_id INTEGER REFERENCES users(id),
  -- stock(在庫) / assigned(割当済み) / lent(貸与中) / returned(返却済み) / repair(修理・使用不可)
  lend_status TEXT NOT NULL DEFAULT 'stock',
  lent_date TEXT,
  passcode_ref TEXT,
  note TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS hire_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hire_id INTEGER NOT NULL REFERENCES hires(id),
  label TEXT NOT NULL,
  ref_location TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by INTEGER
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  user_id INTEGER,
  user_name TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  hire_id INTEGER,
  detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_hire ON hire_tasks(hire_id);
CREATE INDEX IF NOT EXISTS idx_audit_hire ON audit_logs(hire_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
`;

/** 既存のデータベースに後から追加した列(CREATE TABLE IF NOT EXISTS では追加されないため) */
export const MIGRATIONS: { table: string; column: string; ddl: string }[] = [
  { table: "apple_numbers", column: "holder_name", ddl: "ALTER TABLE apple_numbers ADD COLUMN holder_name TEXT" },
  { table: "apple_numbers", column: "holder_note", ddl: "ALTER TABLE apple_numbers ADD COLUMN holder_note TEXT" },
];
