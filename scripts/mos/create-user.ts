// ユーザー作成（初期管理者の作成に使う）
// 使い方: npm run mos:create-user -- --email admin@example.com --name 管理者 --role ADMIN
// パスワードは環境変数 MOS_NEW_USER_PASSWORD か、対話入力で渡す（コマンド履歴に残さないため引数では受け取らない）
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import bcrypt from "bcryptjs";
import { createDb } from "../../src/mos/server/db";
import { seedMasters } from "../../src/mos/server/settings";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name") ?? "管理者";
  const role = (arg("role") ?? "ADMIN") as "ADMIN" | "MANAGER" | "STAFF";
  if (!email || !["ADMIN", "MANAGER", "STAFF"].includes(role)) {
    console.error("使い方: npm run mos:create-user -- --email <メール> --name <氏名> --role ADMIN|MANAGER|STAFF");
    process.exit(1);
  }
  let password = process.env.MOS_NEW_USER_PASSWORD;
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("パスワード（10文字以上）: ");
    rl.close();
  }
  if (!password || password.length < 10) {
    console.error("パスワードは10文字以上にしてください");
    process.exit(1);
  }
  const db = createDb(process.env.DATABASE_URL!);
  await seedMasters(db);
  const user = await db.user.upsert({
    where: { email },
    update: { name, role, passwordHash: await bcrypt.hash(password, 10), active: true },
    create: { email, name, role, passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`ユーザーを登録しました: ${user.email}（${user.role}）`);
  await db.$disconnect();
}

main();
