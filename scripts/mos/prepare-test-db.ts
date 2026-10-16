// テスト用 DB（DATABASE_URL_TEST）にマイグレーションを適用する
import "dotenv/config";
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL_TEST;
if (!url) {
  console.error("DATABASE_URL_TEST が設定されていません");
  process.exit(1);
}
execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
