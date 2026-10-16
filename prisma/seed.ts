// マスタ初期データ（勘定科目・分類ルール）の投入
import "dotenv/config";
import { createDb } from "../src/mos/server/db";
import { seedMasters } from "../src/mos/server/settings";

const db = createDb(process.env.DATABASE_URL!);
seedMasters(db)
  .then(() => console.log("マスタを投入しました"))
  .finally(() => db.$disconnect());
