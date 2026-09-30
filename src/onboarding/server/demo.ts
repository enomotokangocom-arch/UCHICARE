import { DB, addDays, get, run, todayStr } from "./db";
import { loadActor } from "./core";
import { createUserRow, seedMaster, setSetting } from "./seed";
import { createHire } from "./hires";
import { reserveNext, recordCreated } from "./apple";
import { createDevice } from "./devices";
import { recordRequested, recordIssued } from "./requests";
import { updateTaskStatus, setDeviceCheck } from "./tasks";

/**
 * デモデータ。職員・事業所・端末はすべて架空・ダミーです(実在の職員情報は含みません)。
 * デモ用ログインのパスワードは README に記載の共通値です。本番運用では使用しないでください。
 */
export const DEMO_PASSWORD = "demo-pass-2026";

export function seedDemo(db: DB) {
  seedMaster(db);
  if (get(db, "SELECT 1 FROM users LIMIT 1")) throw new Error("既にユーザーが登録されています。空のデータベースで実行してください。");
  setSetting(db, "mode", "demo");

  const houmon = get<{ id: number }>(db, "SELECT id FROM departments WHERE code = 'houmon'")!.id;
  const kyotaku = get<{ id: number }>(db, "SELECT id FROM departments WHERE code = 'kyotaku'")!.id;
  const o1 = Number(run(db, "INSERT INTO offices (name, department_id) VALUES ('【デモ】さくら訪問看護ステーション', ?)", houmon).lastInsertRowid);
  const o2 = Number(run(db, "INSERT INTO offices (name, department_id) VALUES ('【デモ】あおば訪問看護ステーション', ?)", houmon).lastInsertRowid);
  const o3 = Number(run(db, "INSERT INTO offices (name, department_id) VALUES ('【デモ】みどり居宅介護支援事業所', ?)", kyotaku).lastInsertRowid);

  const pw = DEMO_PASSWORD;
  const enomoto = createUserRow(db, { login_id: "enomoto", name: "榎本(代表・デモ)", role: "admin", password: pw, is_representative: true });
  const admin = createUserRow(db, { login_id: "admin", name: "管理者 デモ", role: "admin", password: pw });
  const prep1 = createUserRow(db, { login_id: "prep1", name: "準備担当 一郎(デモ)", role: "preparer", password: pw });
  const prep2 = createUserRow(db, { login_id: "prep2", name: "準備担当 花子(デモ)", role: "preparer", password: pw });
  const jimu = createUserRow(db, { login_id: "jimu", name: "事務 次郎(デモ)", role: "issuer", password: pw });
  const sekinin = createUserRow(db, { login_id: "sekinin", name: "責任者 三郎(デモ)", role: "issuer", password: pw });
  createUserRow(db, { login_id: "viewer", name: "閲覧 四郎(デモ)", role: "viewer", password: pw, scope_office_ids: [o1] });

  // 役割が確定している発行担当のみ、デモ用ユーザーを割り当て(本番では管理者が設定)
  run(db, "UPDATE services SET issuer_user_id = ? WHERE code IN ('ibow','lineworks')", jimu);
  run(db, "UPDATE services SET issuer_user_id = ? WHERE code = 'zest'", sekinin);
  run(db, "UPDATE services SET issuer_user_id = ? WHERE code = 'enursing'", enomoto);

  const actor = loadActor(db, admin)!;
  const jt = (name: string) => get<{ id: number }>(db, "SELECT id FROM job_types WHERE name = ?", name)?.id ?? null;
  const today = todayStr();

  const h1 = createHire(db, actor, {
    name: "山田 さくら(架空)", name_romaji: "Sakura Yamada", job_type_id: jt("看護師"), department_id: houmon, office_id: o1,
    start_date: addDays(today, 20), preparer_id: prep1, deputy_id: prep2, checker_id: admin,
  });
  const h2 = createHire(db, actor, {
    name: "佐藤 みどり(架空)", name_romaji: "Midori Sato", job_type_id: jt("介護支援専門員"), department_id: kyotaku, office_id: o3,
    start_date: addDays(today, 12), preparer_id: prep2, deputy_id: prep1, checker_id: admin,
  });
  createHire(db, actor, {
    name: "鈴木 たろう(架空)", name_romaji: "Taro Suzuki", job_type_id: jt("理学療法士"), department_id: houmon, office_id: o2,
    start_date: addDays(today, 5), preparer_id: prep1, checker_id: admin,
  });

  // 1人目: 途中まで進んだ状態を作る
  const p1 = loadActor(db, prep1)!;
  const taskId = (hireId: number, code: string) => get<{ id: number }>(db, "SELECT id FROM hire_tasks WHERE hire_id = ? AND template_code = ?", hireId, code)!.id;
  updateTaskStatus(db, p1, taskId(h1, "hire_info"), { status: "done" });
  setDeviceCheck(db, p1, taskId(h1, "device_secure"), "iphone", true);
  setDeviceCheck(db, p1, taskId(h1, "device_secure"), "ipad", true);
  updateTaskStatus(db, p1, taskId(h1, "device_secure"), { status: "done" });
  createDevice(db, p1, { asset_no: "DEMO-IP-001", kind: "iPhone", model: "iPhone(デモ)", serial: "DEMOSERIAL0001", phone_number: "000-0000-0001", hire_id: h1 });
  createDevice(db, p1, { asset_no: "DEMO-PAD-001", kind: "iPad", model: "iPad(デモ)", serial: "DEMOSERIAL0002", hire_id: h1 });
  setDeviceCheck(db, p1, taskId(h1, "device_register"), "iphone", true);
  setDeviceCheck(db, p1, taskId(h1, "device_register"), "ipad", true);
  updateTaskStatus(db, p1, taskId(h1, "device_register"), { status: "done" });
  const a1 = reserveNext(db, p1, h1);
  updateTaskStatus(db, p1, taskId(h1, "apple_reserve"), { status: "done" });
  recordCreated(db, p1, a1.id, a1.planned_email);
  updateTaskStatus(db, p1, taskId(h1, "apple_create"), { status: "done" });
  const reqIds = (hireId: number, codes: string[]) =>
    codes.map((c) => get<{ id: number }>(db, "SELECT ar.id FROM account_requests ar JOIN services s ON s.id = ar.service_id WHERE ar.hire_id = ? AND s.code = ?", hireId, c)!.id);
  recordRequested(db, p1, h1, { request_ids: reqIds(h1, ["ibow", "lineworks"]), requested_to: "事務 次郎(デモ)", request_method: "LINE WORKS" });
  recordIssued(db, loadActor(db, jimu)!, reqIds(h1, ["lineworks"])[0], { issued_login_id: "sakura.yamada" });
  updateTaskStatus(db, p1, taskId(h1, "issue_request"), { status: "waiting_issue" });

  // 2人目: 番号予約のみ(メール未確定)
  reserveNext(db, loadActor(db, prep2)!, h2);
}
