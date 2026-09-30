// 同時予約テスト用のワーカープロセス: 指定した入職者の番号を一斉に予約する
import { openDb } from "../../src/onboarding/server/db";
import { loadActor } from "../../src/onboarding/server/core";
import { reserveNext } from "../../src/onboarding/server/apple";

const [dbPath, actorId, startAt, ...hireIds] = process.argv.slice(2);
const db = openDb(dbPath);
const actor = loadActor(db, Number(actorId))!;
while (Date.now() < Number(startAt)) { /* 開始時刻まで待機して同時に走らせる */ }
const results: number[] = [];
for (const h of hireIds) results.push(reserveNext(db, actor, Number(h)).number);
process.stdout.write(JSON.stringify(results));
