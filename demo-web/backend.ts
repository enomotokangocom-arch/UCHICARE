/**
 * ブラウザ内デモ用: /api/onboarding/* への通信を、ブラウザ内で同じ業務ロジック(dispatch)に渡します。
 * サーバー版と同じ権限チェック・業務ルールがそのまま動きます。
 */
import type { DB } from "./shims/db";
import { dispatch } from "../src/onboarding/server/api";
import { actorFromToken, login, logout } from "../src/onboarding/server/auth";
import { AppError, audit, getSetting } from "../src/onboarding/server/core";
import { get } from "./shims/db";

const TOKEN_KEY = "uchicare-onboarding-demo-token";

function readToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return memToken; }
}
function writeToken(t: string | null) {
  memToken = t;
  try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch { /* 保存できない環境 */ }
}
let memToken: string | null = null;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data ?? { ok: true }), { status, headers: { "content-type": "application/json" } });

export function installBackend(db: DB, persist: () => void) {
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const u = new URL(url, "https://demo.invalid");
    if (!u.pathname.startsWith("/api/onboarding")) return origFetch(input, init);
    const method = (init?.method ?? "GET").toUpperCase();
    const path = u.pathname.slice("/api/onboarding".length) || "/";
    let body: Record<string, unknown> = {};
    if (init?.body && typeof init.body === "string") {
      try { body = JSON.parse(init.body); } catch { return json({ error: "送信内容を読み取れませんでした。" }, 400); }
    }
    try {
      if (path === "/auth/status") {
        return json({ needsInit: !get(db, "SELECT 1 FROM users LIMIT 1"), demo: getSetting(db, "mode") === "demo" });
      }
      if (path === "/auth/login" && method === "POST") {
        const r = login(db, body.login_id, body.password);
        audit(db, r.actor, "ログイン", "user", r.actor.id, null);
        writeToken(r.token);
        persist();
        return json({ actor: r.actor });
      }
      if (path === "/auth/logout") {
        logout(db, readToken());
        writeToken(null);
        persist();
        return json({ ok: true });
      }
      const actor = actorFromToken(db, readToken());
      if (!actor) return json({ error: "ログインしてください。", needsInit: false }, 401);
      const result = dispatch(db, actor, method, path, body, u.searchParams);
      if (method !== "GET") persist();
      return json(result);
    } catch (e) {
      if (e instanceof AppError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: "エラーが発生しました: " + (e as Error).message }, 500);
    }
  };
}
