/**
 * デモを1コマンドで起動します(Windows・Macどちらでも可)。
 *   npm run demo
 * data/demo.db にデモデータ(架空の職員)がなければ作成し、開発サーバーを起動します。
 * 実データ用の data/onboarding.db には触れません。
 */
import path from "node:path";
import { spawn } from "node:child_process";

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`Node.js 22.13 以上が必要です(現在 ${process.versions.node})。https://nodejs.org から LTS 版を入れてください。`);
  process.exit(1);
}

const dbPath = path.join(process.cwd(), "data", "demo.db");
process.env.ONBOARDING_DB_PATH = dbPath;

async function main() {
  const { openDb, get } = await import("../../src/onboarding/server/db");
  const { seedDemo, DEMO_PASSWORD } = await import("../../src/onboarding/server/demo");
  const db = openDb(dbPath);
  if (!get(db, "SELECT 1 FROM users LIMIT 1")) {
    seedDemo(db);
    console.log("デモデータを作成しました。");
  }
  db.close();
  console.log("");
  console.log("  ブラウザで http://localhost:3000/onboarding を開いてください");
  console.log(`  ログインID: admin(管理者)/ prep1(準備担当者)/ jimu(事務)/ viewer(閲覧者)  パスワード: ${DEMO_PASSWORD}`);
  console.log("");
  const next = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [next, "dev"], { stdio: "inherit", env: process.env });
  child.on("exit", (code) => process.exit(code ?? 0));
}
main();
