// 全体の再計算（Vercel 以外の環境では crontab 等で毎朝8時 JST に実行する）
// 例: 0 8 * * * cd /path/to/app && TZ=Asia/Tokyo npm run mos:recalc
import "dotenv/config";
import { createDb } from "../../src/mos/server/db";
import { recalculate } from "../../src/mos/server/recalc";

async function main() {
  const db = createDb(process.env.DATABASE_URL!);
  const r = await recalculate(db, { trigger: "CRON" });
  console.log(`再計算しました（${r.months}か月）`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
