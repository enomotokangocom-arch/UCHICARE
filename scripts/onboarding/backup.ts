/**
 * バックアップ: 稼働中でも安全にコピーできる VACUUM INTO を使い、backups/ に日時付きで保存します。
 *   npm run onboarding:backup
 */
import fs from "node:fs";
import path from "node:path";
import { defaultDbPath, openDb } from "../../src/onboarding/server/db";

const src = defaultDbPath();
if (!fs.existsSync(src)) {
  console.error(`データベースがありません: ${src}`);
  process.exit(1);
}
const dir = process.env.ONBOARDING_BACKUP_DIR || path.join(process.cwd(), "backups");
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date(Date.now() + 9 * 3600e3).toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const dest = path.join(dir, `onboarding-${stamp}.db`);
const db = openDb(src);
db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
console.log(`バックアップを作成しました: ${dest}`);
console.log("※ バックアップにはユーザー情報(パスワードはハッシュ)と認証情報の参照先が含まれます。社内の安全な場所に保管してください。");
