import { DB, all } from "./db";
import { Actor, AppError, badRequest, forbidden, getSetting, notFound, requireRole } from "./core";
import * as hires from "./hires";
import * as tasks from "./tasks";
import * as apple from "./apple";
import * as requests from "./requests";
import * as devices from "./devices";
import * as admin from "./admin";
import { progressCsv } from "./exports";
import { assertViewHire } from "./authz";

/**
 * APIの振り分け。すべてのリクエストはログイン済みの利用者(actor)で実行され、
 * 各業務関数の中でサーバー側の権限チェックを行います。
 */

type Body = Record<string, unknown>;
type Handler = (ctx: { db: DB; actor: Actor; params: string[]; body: Body; query: URLSearchParams }) => unknown;
type Route = { method: string; pattern: RegExp; handler: Handler };

const id = (s: string) => {
  const n = Number(s);
  if (!Number.isInteger(n) || n <= 0) throw notFound();
  return n;
};
const qnum = (q: URLSearchParams, k: string) => (q.get(k) ? Number(q.get(k)) : null);

const routes: Route[] = [];
const r = (method: string, path: string, handler: Handler) =>
  routes.push({ method, pattern: new RegExp("^" + path.replace(/:\w+/g, "(\\d+)") + "$"), handler });

// ---- 共通 ----
r("GET", "/me", ({ actor, db }) => ({ actor, mode: getSetting(db, "mode") }));
r("GET", "/options", ({ db, actor }) => ({
  departments: all(db, "SELECT id, code, name FROM departments ORDER BY sort"),
  offices: all(db, "SELECT id, name, department_id, active FROM offices ORDER BY id"),
  jobTypes: all(db, "SELECT id, name, active FROM job_types ORDER BY id"),
  users: actor.role === "viewer" ? [] : all(db, "SELECT id, name, role, is_representative FROM users WHERE active = 1 ORDER BY role, id"),
  services: all(db, "SELECT id, name, active FROM services ORDER BY sort"),
  companyGoogle: getSetting(db, "company_google_account"),
}));
r("GET", "/dashboard", ({ db, actor, query }) =>
  hires.dashboard(db, actor, {
    hire_id: qnum(query, "hire_id"), department_id: qnum(query, "department_id"), office_id: qnum(query, "office_id"),
    assignee_id: qnum(query, "assignee_id"), status: query.get("status"),
  }));

// ---- 入職者 ----
r("POST", "/hires", ({ db, actor, body }) => ({ id: hires.createHire(db, actor, body) }));
r("GET", "/hires/:id", ({ db, actor, params, query }) => hires.getHireDetail(db, actor, id(params[0]), { print: query.get("print") === "1" }));
r("PATCH", "/hires/:id", ({ db, actor, params, body }) => hires.updateHire(db, actor, id(params[0]), body));
r("POST", "/hires/:id/ready", ({ db, actor, params }) => hires.markReady(db, actor, id(params[0])));
r("POST", "/hires/:id/confirm", ({ db, actor, params, body }) => hires.confirmHire(db, actor, id(params[0]), body.note));
r("POST", "/hires/:id/send-back", ({ db, actor, params, body }) => hires.sendBack(db, actor, id(params[0]), body.reason));
r("POST", "/hires/:id/lend", ({ db, actor, params, body }) => hires.recordLending(db, actor, id(params[0]), body));
r("POST", "/hires/:id/apple", ({ db, actor, params }) => apple.reserveNext(db, actor, id(params[0])));
r("POST", "/hires/:id/credentials", ({ db, actor, params, body }) => requests.addCredentialRef(db, actor, id(params[0]), body));
r("POST", "/hires/:id/services", ({ db, actor, params, body }) => requests.addServiceToHire(db, actor, id(params[0]), body.service_id, body.requirement));
r("POST", "/hires/:id/request-text", ({ db, actor, params, body }) => requests.buildRequestText(db, actor, id(params[0]), body.request_ids, body.recipient));
r("POST", "/hires/:id/request-record", ({ db, actor, params, body }) => requests.recordRequested(db, actor, id(params[0]), body));
r("GET", "/hires/:id/missing-services", ({ db, actor, params }) => {
  requireRole(actor, "admin");
  const hid = id(params[0]);
  assertViewHire(db, actor, hid);
  return all(
    db,
    `SELECT s.id, s.name, ds.requirement FROM services s
       JOIN department_services ds ON ds.service_id = s.id AND ds.department_id = (SELECT department_id FROM hires WHERE id = ?)
      WHERE s.active = 1 AND ds.requirement <> 'excluded'
        AND NOT EXISTS (SELECT 1 FROM hire_services hs WHERE hs.hire_id = ? AND hs.service_id = s.id)`,
    hid, hid,
  );
});
r("DELETE", "/credentials/:id", ({ db, actor, params }) => requests.deleteCredentialRef(db, actor, id(params[0])));

// ---- 作業 ----
r("GET", "/tasks/:id", ({ db, actor, params }) => tasks.getTaskDetail(db, actor, id(params[0])));
r("PATCH", "/tasks/:id", ({ db, actor, params, body }) => {
  const tid = id(params[0]);
  if (body.action === "status") return tasks.updateTaskStatus(db, actor, tid, body);
  if (body.action === "device") return tasks.setDeviceCheck(db, actor, tid, body.device, body.checked);
  if (body.action === "assign") return tasks.updateTaskAssignment(db, actor, tid, body);
  throw badRequest("操作が正しくありません。");
});
r("POST", "/tasks/:id/comments", ({ db, actor, params, body }) => tasks.addTaskComment(db, actor, id(params[0]), body.body));

// ---- サービス別(配置・ログイン確認)と発行依頼 ----
r("PATCH", "/hire-services/:id", ({ db, actor, params, body }) => requests.updateHireService(db, actor, id(params[0]), body));
r("PATCH", "/requests/:id", ({ db, actor, params, body }) => {
  const rid = id(params[0]);
  if (body.action === "issued") return requests.recordIssued(db, actor, rid, body);
  return requests.updateRequest(db, actor, rid, body);
});

// ---- Apple番号 ----
r("GET", "/apple", ({ db, actor }) => apple.listNumbers(db, actor));
r("POST", "/apple/:id", ({ db, actor, params, body }) => {
  const aid = id(params[0]);
  switch (body.action) {
    case "created": return apple.recordCreated(db, actor, aid, body.actual_email, body.note);
    case "failed": return apple.recordFailed(db, actor, aid, body.reason, body.mark);
    case "cancel": return apple.cancelNumber(db, actor, aid, body.reason);
    case "unusable": return apple.markUnusable(db, actor, aid, body.reason);
    case "reuse": return apple.approveReuse(db, actor, aid, Number(body.hire_id), body.note);
  }
  throw badRequest("操作が正しくありません。");
});

// ---- 端末台帳 ----
r("GET", "/devices", ({ db, actor }) => devices.listDevices(db, actor));
r("POST", "/devices", ({ db, actor, body }) => ({ id: devices.createDevice(db, actor, body) }));
r("PATCH", "/devices/:id", ({ db, actor, params, body }) => devices.updateDevice(db, actor, id(params[0]), body));

// ---- 手順書・出力 ----
r("GET", "/manual/:id", ({ db, actor, params }) => {
  if (actor.role === "viewer") throw forbidden();
  return admin.getManual(db, id(params[0]));
});

// ---- 管理設定(管理者のみ) ----
r("GET", "/admin/settings", ({ db, actor }) => { requireRole(actor, "admin"); return { settings: admin.getSettingsView(db), unset: admin.unsetItems(db) }; });
r("PATCH", "/admin/settings", ({ db, actor, body }) => admin.updateSettings(db, actor, body));
r("GET", "/admin/services", ({ db, actor }) => admin.listServices(db, actor));
r("POST", "/admin/services", ({ db, actor, body }) => ({ id: admin.saveService(db, actor, null, body) }));
r("PATCH", "/admin/services/:id", ({ db, actor, params, body }) => admin.saveService(db, actor, id(params[0]), body));
r("PUT", "/admin/department-services", ({ db, actor, body }) =>
  admin.setDepartmentRequirement(db, actor, Number(body.department_id), Number(body.service_id), body.requirement));
r("GET", "/admin/templates", ({ db, actor }) => { requireRole(actor, "admin"); return admin.listTemplates(db); });
r("POST", "/admin/templates", ({ db, actor, body }) => ({ id: admin.saveTemplate(db, actor, null, body, body.summary) }));
r("PATCH", "/admin/templates/:id", ({ db, actor, params, body }) => admin.saveTemplate(db, actor, id(params[0]), body, body.summary));
r("GET", "/admin/templates/:id/preview", ({ db, actor, params }) => ({
  ...admin.previewTemplateApply(db, actor, id(params[0])),
  revisions: admin.templateRevisions(db, id(params[0])),
}));
r("POST", "/admin/templates/:id/apply", ({ db, actor, params, body }) => admin.applyTemplate(db, actor, id(params[0]), body));
r("POST", "/admin/offices", ({ db, actor, body }) => admin.saveOffice(db, actor, null, body));
r("PATCH", "/admin/offices/:id", ({ db, actor, params, body }) => admin.saveOffice(db, actor, id(params[0]), body));
r("POST", "/admin/job-types", ({ db, actor, body }) => admin.saveJobType(db, actor, null, body));
r("PATCH", "/admin/job-types/:id", ({ db, actor, params, body }) => admin.saveJobType(db, actor, id(params[0]), body));
r("GET", "/admin/users", ({ db, actor }) => { requireRole(actor, "admin"); return admin.listUsers(db); });
r("POST", "/admin/users", ({ db, actor, body }) => ({ id: admin.saveUser(db, actor, null, body) }));
r("PATCH", "/admin/users/:id", ({ db, actor, params, body }) => admin.saveUser(db, actor, id(params[0]), body));
r("GET", "/admin/audit", ({ db, actor, query }) => admin.listAudit(db, actor, { entity: query.get("entity") }));

export function dispatch(db: DB, actor: Actor, method: string, path: string, body: Body, query: URLSearchParams) {
  for (const route of routes) {
    if (route.method !== method) continue;
    const m = route.pattern.exec(path);
    if (m) return route.handler({ db, actor, params: m.slice(1), body, query });
  }
  throw new AppError(404, "APIが見つかりません。");
}

export function exportCsv(db: DB, actor: Actor) {
  return progressCsv(db, actor);
}

