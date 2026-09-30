/**
 * デモデータの投入(架空の職員・ダミー端末)。
 *   npm run onboarding:demo            … 既定のDB(data/onboarding.db)が空のときのみ投入
 *   ONBOARDING_DB_PATH=data/demo.db npm run onboarding:demo … 別ファイルに投入
 */
import { defaultDbPath, openDb } from "../../src/onboarding/server/db";
import { DEMO_PASSWORD, seedDemo } from "../../src/onboarding/server/demo";

const path = defaultDbPath();
const db = openDb(path);
try {
  seedDemo(db);
  console.log(`デモデータを投入しました: ${path}`);
  console.log(`ログインID: enomoto / admin / prep1 / prep2 / jimu / sekinin / viewer  共通パスワード: ${DEMO_PASSWORD}`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
