/**
 * 復元: 指定したバックアップを検証してから現在のデータベースと置き換えます。
 * 置き換え前のデータベースは *.before-restore-日時 として残します。
 *   (サーバーを停止してから) npm run onboarding:restore -- backups/onboarding-20261001-0900.db
 */
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { defaultDbPath } from "../../src/onboarding/server/db";

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error("復元するバックアップファイルを指定してください。例: npm run onboarding:restore -- backups/onboarding-xxxx.db");
  process.exit(1);
}
const check = new DatabaseSync(file, { readOnly: true });
const result = check.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
const hasTables = check.prepare("SELECT 1 FROM sqlite_master WHERE name = 'hires'").get();
check.close();
if (result.integrity_check !== "ok" || !hasTables) {
  console.error("バックアップファイルが壊れているか、このツールのデータではありません。");
  process.exit(1);
}
const dest = defaultDbPath();
if (fs.existsSync(dest)) {
  const keep = `${dest}.before-restore-${Date.now()}`;
  fs.copyFileSync(dest, keep);
  console.log(`現在のデータを退避しました: ${keep}`);
}
for (const ext of ["-wal", "-shm"]) if (fs.existsSync(dest + ext)) fs.rmSync(dest + ext);
fs.copyFileSync(file, dest);
console.log(`復元しました: ${file} → ${dest}`);
console.log("サーバーを起動し直してください。");
