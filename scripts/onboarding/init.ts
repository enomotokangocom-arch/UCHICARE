/**
 * 本番(実データ)用の初期化。
 * マスタデータ(部門・サービス・標準手順)を投入し、最初の管理者ユーザーを作成します。
 * パスワードは画面に表示・保存せず、入力値のハッシュのみを保存します。
 *
 *   npm run onboarding:init
 */
import readline from "node:readline";
import { defaultDbPath, get, openDb } from "../../src/onboarding/server/db";
import { createUserRow, seedMaster, setSetting } from "../../src/onboarding/server/seed";

function ask(q: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    // 入力したパスワードを画面に表示しない
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      if (s.includes(q)) process.stdout.write(q);
    };
  }
  return new Promise((resolve) => rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(a.trim()); }));
}

async function main() {
  const path = defaultDbPath();
  const db = openDb(path);
  seedMaster(db);
  if (get(db, "SELECT 1 FROM users LIMIT 1")) {
    console.log(`既にユーザーが登録されています(${path})。追加・変更は管理設定画面から行ってください。`);
    return;
  }
  setSetting(db, "mode", "production");
  console.log("最初の管理者ユーザーを作成します。");
  const name = await ask("氏名: ");
  const loginId = await ask("ログインID(半角英数字): ");
  const pw = process.env.ONBOARDING_ADMIN_PASSWORD || (await ask("パスワード(8文字以上・表示されません): ", true));
  if (!name || !/^[A-Za-z0-9._-]{3,}$/.test(loginId) || pw.length < 8) {
    console.error("入力内容が正しくありません。やり直してください。");
    process.exit(1);
  }
  createUserRow(db, { login_id: loginId, name, role: "admin", password: pw });
  console.log(`作成しました。データベース: ${path}`);
  console.log("npm run dev(または npm run build && npm start)で起動し、/onboarding からログインしてください。");
}
main();
