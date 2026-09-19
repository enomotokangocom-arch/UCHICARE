import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  OCCUPATION_CODES,
  OCCUPATION_LABELS,
  DEFAULT_TAGS,
  DEFAULT_AREAS,
  DEFAULT_INFLOW_SOURCES,
  DEFAULT_LEAD_SCORE_RULES,
} from "../src/lib/crm/constants";

const prisma = new PrismaClient();

function body(text: string, cta?: Array<{ label: string; type: "postback" | "uri"; value: string }>) {
  return JSON.stringify({ text, cta: cta ?? [] });
}

async function main() {
  console.log("Seeding master data...");

  // 職種
  for (const [i, code] of OCCUPATION_CODES.entries()) {
    await prisma.occupation.upsert({
      where: { code },
      update: {},
      create: { code, name: OCCUPATION_LABELS[code], sortOrder: i },
    });
  }

  // エリア
  for (const [i, name] of DEFAULT_AREAS.entries()) {
    const existing = await prisma.area.findFirst({ where: { name } });
    if (!existing) {
      await prisma.area.create({ data: { name, sortOrder: i } });
    }
  }

  // タグ
  for (const [i, tag] of DEFAULT_TAGS.entries()) {
    await prisma.tag.upsert({
      where: { code: tag.code },
      update: {},
      create: { ...tag, sortOrder: i },
    });
  }

  // 流入経路
  for (const source of DEFAULT_INFLOW_SOURCES) {
    await prisma.inflowSource.upsert({
      where: { code: source.code },
      update: {},
      create: source,
    });
  }

  // Lead Scoreルール
  for (const rule of DEFAULT_LEAD_SCORE_RULES) {
    await prisma.leadScoreRule.upsert({
      where: { actionCode: rule.actionCode },
      update: {},
      create: rule,
    });
  }

  const scoreConfig = await prisma.leadScoreConfig.findFirst();
  if (!scoreConfig) {
    await prisma.leadScoreConfig.create({
      data: { warmThreshold: 20, hotThreshold: 50 },
    });
  }

  // リッチメニュー初期設定 (6メニュー)
  const richMenuDefaults = [
    { slot: 1, label: "Uchi careを知る", actionValue: "https://example.com/about" },
    { slot: 2, label: "スタッフを知る", actionValue: "https://example.com/staff" },
    { slot: 3, label: "求人情報", actionValue: "https://example.com/jobs" },
    { slot: 4, label: "給与・待遇", actionValue: "https://example.com/salary" },
    { slot: 5, label: "見学・カジュアル面談", actionValue: "CASUAL_VISIT_MENU" },
    { slot: 6, label: "LINEで質問", actionValue: "QUESTION_MENU" },
  ];
  for (const menu of richMenuDefaults) {
    await prisma.richMenuConfig.upsert({
      where: { slot: menu.slot },
      update: {},
      create: {
        slot: menu.slot,
        label: menu.label,
        actionType: menu.actionValue.startsWith("http") ? "URL" : "POSTBACK",
        actionValue: menu.actionValue,
      },
    });
  }

  // 30日ナーチャリング ステップ配信シーケンス
  let sequence = await prisma.stepSequence.findFirst({ where: { name: "30日間オンボーディングシーケンス" } });
  if (!sequence) {
    sequence = await prisma.stepSequence.create({
      data: { name: "30日間オンボーディングシーケンス", description: "友だち追加日を起点に自動配信する標準シーケンス" },
    });
  }

  const occupations = await prisma.occupation.findMany();
  const occMap = Object.fromEntries(occupations.map((o) => [o.code, o.id]));

  async function upsertStep(dayOffset: number, title: string, text: string, occCodes?: string[], cta?: Array<{ label: string; type: "postback" | "uri"; value: string }>) {
    const existing = await prisma.stepMessage.findFirst({ where: { stepSequenceId: sequence!.id, dayOffset, title } });
    const data = {
      stepSequenceId: sequence!.id,
      dayOffset,
      title,
      body: body(text, cta),
    };
    const step = existing
      ? await prisma.stepMessage.update({ where: { id: existing.id }, data })
      : await prisma.stepMessage.create({ data });

    if (occCodes && occCodes.length > 0) {
      await prisma.stepMessageOccupation.deleteMany({ where: { stepMessageId: step.id } });
      for (const code of occCodes) {
        if (occMap[code]) {
          await prisma.stepMessageOccupation.create({
            data: { stepMessageId: step.id, occupationId: occMap[code] },
          });
        }
      }
    }
    return step;
  }

  await upsertStep(
    0,
    "ウェルカムメッセージ",
    "Uchi careの採用公式LINEに友だち追加いただきありがとうございます!今後、会社の情報やスタッフの声、求人情報などをお届けします。まずは簡単な質問にご協力ください。"
  );

  await upsertStep(
    1,
    "会社紹介",
    "【Uchi careについて】\nMission・Vision・Valueや事業内容、私たちが目指している方向性についてご紹介します。地域の医療・介護を支えるパートナーとして、一人ひとりの想いを大切にしています。"
  );

  await upsertStep(3, "訪問看護って実際どう?", "【看護師のみなさまへ】\n訪問看護って実際どう?をテーマに、現場のリアルな声をお届けします。", ["JOB_NS"]);
  await upsertStep(3, "訪問リハって実際どう?", "【PT・OT・STのみなさまへ】\n訪問リハって実際どう?をテーマに、現場のリアルな声をお届けします。", ["JOB_PT", "JOB_OT", "JOB_ST"]);
  await upsertStep(3, "ケアプランセンターで働くとは", "【ケアマネジャーのみなさまへ】\nうちケアプランセンターで働くとは?をテーマにご紹介します。", ["JOB_CM"]);
  await upsertStep(3, "Uchi careの日常", "Uchi careで働くスタッフの日常や大切にしている価値観をご紹介します。");

  await upsertStep(7, "Uchi care PEOPLE", "【スタッフ紹介】\n「Uchi care PEOPLE」と題して、現場で活躍するスタッフをご紹介します。");

  await upsertStep(10, "看護師の1日の働き方", "【1日の働き方】\n看護師の訪問件数目安は1日4〜6件です。無理のないペースで、丁寧なケアを大切にしています。", ["JOB_NS"]);
  await upsertStep(10, "療法士の1日の働き方", "【1日の働き方】\n療法士の訪問件数目安は1日5〜7件です。移動時間や記録時間も考慮したスケジュールを組んでいます。", ["JOB_PT", "JOB_OT", "JOB_ST"]);
  await upsertStep(10, "1日の働き方", "Uchi careでの1日の働き方についてご紹介します。");

  await upsertStep(14, "給与・休日・福利厚生", "【給与・休日・福利厚生】\n働き方や待遇について詳しくご紹介します。気になる方はぜひ求人情報もチェックしてください。");

  await upsertStep(21, "教育・キャリア・成長環境", "【教育・キャリア・成長環境】\nUchi careでは研修制度やキャリアパスを整え、成長し続けられる環境を用意しています。");

  await upsertStep(
    30,
    "今後についてお伺いします",
    "ここまでUchi careについてご紹介してきました。今の率直なお気持ちを教えてください。",
    undefined,
    [
      { label: "まず話を聞いてみたい", type: "postback", value: "CTA_CASUAL" },
      { label: "事業所を見学したい", type: "postback", value: "CTA_VISIT" },
      { label: "求人について詳しく知りたい", type: "postback", value: "CTA_JOB_INFO" },
      { label: "今はまだ情報収集", type: "postback", value: "CTA_RESEARCH" },
    ]
  );

  // スタッフアカウント
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@uchicare.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const adminHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.staffUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash: adminHash, name: "管理者", role: "ADMIN" },
  });

  const recruiterHash = await bcrypt.hash("Recruiter123!", 12);
  await prisma.staffUser.upsert({
    where: { email: "recruiter@uchicare.local" },
    update: {},
    create: { email: "recruiter@uchicare.local", passwordHash: recruiterHash, name: "採用担当 太郎", role: "RECRUITER" },
  });

  const viewerHash = await bcrypt.hash("Viewer123!", 12);
  await prisma.staffUser.upsert({
    where: { email: "viewer@uchicare.local" },
    update: {},
    create: { email: "viewer@uchicare.local", passwordHash: viewerHash, name: "閲覧専用ユーザー", role: "VIEWER" },
  });

  console.log(`Seed admin login: ${adminEmail} / (SEED_ADMIN_PASSWORD env value)`);

  // デモ候補者データ (画面確認用)
  const existingCandidateCount = await prisma.candidate.count();
  if (existingCandidateCount === 0) {
    const area = await prisma.area.findFirst();
    const inflow = await prisma.inflowSource.findFirst({ where: { code: "INSTAGRAM" } });
    const demoData = [
      { name: "佐藤 花子", occ: "JOB_NS", timing: "TIME_3M", status: "LEAD_HOT", stage: "CASUAL", score: 65 },
      { name: "鈴木 太郎", occ: "JOB_PT", timing: "TIME_NOW", status: "LEAD_HOT", stage: "VISIT", score: 80 },
      { name: null, occ: "JOB_CM", timing: "TIME_RESEARCH", status: "LEAD_COLD", stage: "NURTURING", score: 5 },
      { name: "高橋 optimist", occ: "JOB_OT", timing: "TIME_6_12M", status: "LEAD_WARM", stage: "NURTURING", score: 25 },
      { name: "田中 恵子", occ: "JOB_ST", timing: "TIME_3M", status: "LEAD_WARM", stage: "APPLIED", score: 55 },
      { name: null, occ: "JOB_NS", timing: "TIME_RESEARCH", status: "LEAD_COLD", stage: "NURTURING", score: 0 },
    ] as const;

    for (const [i, d] of demoData.entries()) {
      const occupation = occupations.find((o) => o.code === d.occ);
      const candidate = await prisma.candidate.create({
        data: {
          lineUserId: `demo-line-user-${i + 1}`,
          lineDisplayName: d.name ?? `LINEユーザー${i + 1}`,
          name: d.name,
          occupationId: occupation?.id,
          transferTiming: d.timing,
          areaId: area?.id,
          inflowSourceId: inflow?.id,
          leadStatus: d.status,
          leadScore: d.score,
          stage: d.stage,
          assignedStaffId: admin.id,
          registeredAt: new Date(Date.now() - (i + 1) * 5 * 24 * 60 * 60 * 1000),
          lastLineReactionAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        },
      });
      await prisma.candidateEvent.create({
        data: {
          candidateId: candidate.id,
          type: "LINE_FOLLOW",
          label: "LINE友だち登録",
          actorType: "SYSTEM",
        },
      });
      if (occupation) {
        await prisma.candidateEvent.create({
          data: {
            candidateId: candidate.id,
            type: "OCCUPATION_SET",
            label: `職種選択: ${occupation.name}`,
            actorType: "CANDIDATE",
          },
        });
      }
    }
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
