/**
 * Phase1 サンプルデータ生成スクリプト (docs/uchi-os/15-phase1-plan.md 15.2節)。
 *
 * 3拠点の訪問看護法人 + 直近12ヶ月のダミーデータを投入する。
 * 仙台東ステーションの直近1ヶ月に「利用終了増加・新規利用者減少・稼働率低下・売上急落」の
 * 異常パターンを注入し、CEO Morningで DR-01(売上低下)・DR-06(稼働率低下) が検知されることを
 * デモできるようにする。
 *
 * 実行: npm run seed:uchi-os
 */
import seedrandom from "seedrandom";
import { prisma } from "../../src/server/uchi-os/db/client";
import { hashPassword } from "../../src/server/uchi-os/auth/password";
import { monthRange, shiftYearMonth, formatYearMonth } from "../../src/server/uchi-os/kpi-engine/dates";
import { recomputeKpiSnapshotsForMonth } from "../../src/server/uchi-os/kpi-engine/snapshot";
import { ensureDecisionsForOrg } from "../../src/server/uchi-os/decision-engine/generate";
import type { Prisma, EmployeeType } from "@prisma/client";

const rng = seedrandom("uchi-os-phase1-seed-v1");

function randomInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randomChoice<T>(items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function randomDateInMonth(yearMonth: string): Date {
  const { start, end } = monthRange(yearMonth);
  const ts = start.getTime() + rng() * (end.getTime() - start.getTime());
  return new Date(ts);
}

const CURRENT_YEAR_MONTH = formatYearMonth(new Date());
const MONTHS = Array.from({ length: 12 }, (_, i) => shiftYearMonth(CURRENT_YEAR_MONTH, -(11 - i)));

interface StationPlan {
  key: "tokyo" | "sendai" | "osaka";
  name: string;
  address: string;
  nurseCount: number;
  therapistCount: number;
  officeCount: number;
  revenueBase: number;
  revenueGrowthPerMonth: number; // 月次成長率 (例 0.005 = 0.5%)
  laborCostRatioBaseline: number;
  utilizationBaseline: number; // %
  newPatientsBaseline: number;
  endedPatientsBaseline: number;
  startingPatientPool: number;
  // 仙台東のみ: 最後の1ヶ月に異常を注入する
  anomalyLastMonth?: {
    revenueDropFactor: number; // 例 0.86 = 前月比-14%
    utilization: number;
    newPatients: number;
    endedPatients: number;
  };
}

const STATION_PLANS: StationPlan[] = [
  {
    key: "tokyo",
    name: "東京中央ステーション",
    address: "東京都千代田区1-1-1",
    nurseCount: 8,
    therapistCount: 2,
    officeCount: 2,
    revenueBase: 9_500_000,
    revenueGrowthPerMonth: 0.005,
    laborCostRatioBaseline: 0.56,
    utilizationBaseline: 80,
    newPatientsBaseline: 4,
    endedPatientsBaseline: 3,
    startingPatientPool: 30,
  },
  {
    key: "sendai",
    name: "仙台東ステーション",
    address: "宮城県仙台市若林区2-2-2",
    nurseCount: 6,
    therapistCount: 1,
    officeCount: 1,
    revenueBase: 7_200_000,
    revenueGrowthPerMonth: 0,
    laborCostRatioBaseline: 0.57,
    utilizationBaseline: 78,
    newPatientsBaseline: 3,
    endedPatientsBaseline: 2,
    startingPatientPool: 25,
    anomalyLastMonth: {
      revenueDropFactor: 0.86,
      utilization: 68,
      newPatients: 1,
      endedPatients: 5,
    },
  },
  {
    key: "osaka",
    name: "大阪南ステーション",
    address: "大阪府大阪市住之江区3-3-3",
    nurseCount: 7,
    therapistCount: 2,
    officeCount: 1,
    revenueBase: 6_000_000,
    revenueGrowthPerMonth: 0.01,
    laborCostRatioBaseline: 0.52,
    utilizationBaseline: 85,
    newPatientsBaseline: 5,
    endedPatientsBaseline: 3,
    startingPatientPool: 20,
  },
];

const STANDARD_VISIT_MINUTES_PER_DAY = 360;
const STANDARD_WORKING_DAYS_PER_MONTH = 20;
const END_REASONS = ["HOSPITALIZED", "IMPROVED", "TRANSFERRED", "FAMILY_REQUEST", "OTHER"] as const;

async function resetDatabase() {
  // uchi_os_dev はUchi OS専用DBのため、Organizationを起点にCASCADE削除して冪等に再実行できるようにする。
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Organization" CASCADE');
}

async function main() {
  console.log(`[seed] 対象期間: ${MONTHS[0]} 〜 ${MONTHS[MONTHS.length - 1]}`);
  await resetDatabase();

  const organization = await prisma.organization.create({
    data: { name: "サンプル訪問看護ホールディングス", planTier: "growth" },
  });

  const ownerPasswordHash = await hashPassword("uchi-os-demo-2026");
  const owner = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: "owner@uchi-os-demo.jp",
      name: "経営 太郎",
      passwordHash: ownerPasswordHash,
      role: "OWNER",
    },
  });

  const stations = new Map<string, { id: string; plan: StationPlan }>();
  for (const plan of STATION_PLANS) {
    const station = await prisma.station.create({
      data: {
        organizationId: organization.id,
        name: plan.name,
        address: plan.address,
        openedAt: new Date(monthRange(MONTHS[0]).start.getTime() - 365 * 24 * 60 * 60 * 1000),
        status: "ACTIVE",
      },
    });
    stations.set(plan.key, { id: station.id, plan });
  }

  const sendaiStation = stations.get("sendai")!;
  const stationManagerPasswordHash = await hashPassword("uchi-os-demo-2026");
  await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: "sendai-manager@uchi-os-demo.jp",
      name: "現場 花子",
      passwordHash: stationManagerPasswordHash,
      role: "STATION_MANAGER",
      stationId: sendaiStation.id,
    },
  });

  // ---------- Employees ----------
  const employeesByStation = new Map<string, { id: string; type: EmployeeType }[]>();
  const openedBefore = new Date(monthRange(MONTHS[0]).start.getTime() - 400 * 24 * 60 * 60 * 1000);

  for (const [key, { id: stationId, plan }] of stations) {
    const list: { id: string; type: EmployeeType }[] = [];
    const spec: { type: EmployeeType; count: number }[] = [
      { type: "NURSE", count: plan.nurseCount },
      { type: "THERAPIST", count: plan.therapistCount },
      { type: "OFFICE", count: plan.officeCount },
    ];
    for (const { type, count } of spec) {
      for (let i = 0; i < count; i++) {
        const employee = await prisma.employee.create({
          data: {
            organizationId: organization.id,
            stationId,
            name: `${plan.name.slice(0, 2)}${type[0]}${i + 1}`,
            employeeType: type,
            employmentType: "FULL_TIME",
            fte: 1.0,
            monthlySalaryCost: type === "NURSE" ? 400_000 : 320_000,
            hiredAt: openedBefore,
          },
        });
        list.push({ id: employee.id, type });
      }
    }
    employeesByStation.set(key, list);
  }

  // 東京中央: 同月内で1名退職・1名採用(FTE増減なし、Workforce Dashboardの実績を示すため)
  const tokyoEmployees = employeesByStation.get("tokyo")!;
  const resigningNurseId = tokyoEmployees.find((e) => e.type === "NURSE")!.id;
  const swapMonth = MONTHS[5];
  await prisma.employee.update({
    where: { id: resigningNurseId },
    data: { resignedAt: randomDateInMonth(swapMonth) },
  });
  const replacementNurse = await prisma.employee.create({
    data: {
      organizationId: organization.id,
      stationId: stations.get("tokyo")!.id,
      name: "東京中央N-新",
      employeeType: "NURSE",
      employmentType: "FULL_TIME",
      fte: 1.0,
      monthlySalaryCost: 400_000,
      hiredAt: randomDateInMonth(swapMonth),
    },
  });
  employeesByStation.set(
    "tokyo",
    tokyoEmployees.filter((e) => e.id !== resigningNurseId).concat({ id: replacementNurse.id, type: "NURSE" }),
  );

  // 仙台東: 異常を受けた採用検討中のRecruitmentRecordを1件
  await prisma.recruitmentRecord.create({
    data: {
      organizationId: organization.id,
      stationId: sendaiStation.id,
      targetEmployeeType: "NURSE",
      status: "OPEN",
      postedAt: monthRange(MONTHS[MONTHS.length - 1]).start,
    },
  });

  // ---------- Financial Records ----------
  for (let m = 0; m < MONTHS.length; m++) {
    const yearMonth = MONTHS[m];

    for (const [key, { id: stationId, plan }] of stations) {
      let revenue = Math.round(plan.revenueBase * Math.pow(1 + plan.revenueGrowthPerMonth, m));
      const isAnomalyMonth = key === "sendai" && m === MONTHS.length - 1 && plan.anomalyLastMonth;
      if (isAnomalyMonth) {
        const prevRevenue = Math.round(plan.revenueBase * Math.pow(1 + plan.revenueGrowthPerMonth, m - 1));
        revenue = Math.round(prevRevenue * plan.anomalyLastMonth!.revenueDropFactor);
      }
      const laborCost = Math.round(plan.revenueBase * plan.laborCostRatioBaseline);
      const otherFixedCost = key === "sendai" ? 250_000 : 300_000;
      const otherVariableCost = key === "sendai" ? 120_000 : 150_000;

      await prisma.financialRecord.create({
        data: {
          organizationId: organization.id,
          stationId,
          yearMonth,
          revenue,
          laborCost,
          otherFixedCost,
          otherVariableCost,
        },
      });
    }

    // HQ行 (法人全体の本部費用・現預金)
    await prisma.financialRecord.create({
      data: {
        organizationId: organization.id,
        stationId: null,
        yearMonth,
        revenue: 0,
        laborCost: 500_000,
        otherFixedCost: 800_000,
        otherVariableCost: 0,
        cashBalance: 25_000_000 + m * 200_000,
      },
    });
  }

  // ---------- Patients (新規/終了の月次推移) ----------
  interface PatientRecord {
    id: string;
    pseudoId: string;
  }
  const activePatients = new Map<string, PatientRecord[]>();
  const activePatientsByMonth = new Map<string, Map<string, PatientRecord[]>>(); // stationKey -> yearMonth -> snapshot
  let pseudoSeq = 1;

  for (const [key, { id: stationId, plan }] of stations) {
    const initial: PatientRecord[] = [];
    for (let i = 0; i < plan.startingPatientPool; i++) {
      const pseudoId = `PT-${String(pseudoSeq++).padStart(5, "0")}`;
      const startedAt = new Date(monthRange(MONTHS[0]).start.getTime() - randomInt(30, 700) * 24 * 60 * 60 * 1000);
      const patient = await prisma.patient.create({
        data: {
          organizationId: organization.id,
          stationId,
          pseudoId,
          ageBand: randomChoice(["60-69", "70-79", "80-89", "90-99"]),
          careLevel: randomChoice(["要支援1", "要支援2", "要介護1", "要介護2", "要介護3", "要介護4", "要介護5"]),
          startedAt,
        },
      });
      initial.push({ id: patient.id, pseudoId: patient.pseudoId });
    }
    activePatients.set(key, initial);
  }

  for (let m = 0; m < MONTHS.length; m++) {
    const yearMonth = MONTHS[m];
    for (const [key, { id: stationId, plan }] of stations) {
      const isAnomalyMonth = key === "sendai" && m === MONTHS.length - 1 && plan.anomalyLastMonth;
      const newCount = isAnomalyMonth ? plan.anomalyLastMonth!.newPatients : plan.newPatientsBaseline;
      const endedCount = isAnomalyMonth ? plan.anomalyLastMonth!.endedPatients : plan.endedPatientsBaseline;

      const pool = activePatients.get(key)!;

      // 終了処理
      const toEnd = pool.slice(0, Math.min(endedCount, pool.length));
      for (const patient of toEnd) {
        await prisma.patient.update({
          where: { id: patient.id },
          data: { endedAt: randomDateInMonth(yearMonth), endReason: randomChoice([...END_REASONS]) },
        });
      }
      const remaining = pool.filter((p) => !toEnd.includes(p));

      // 新規追加
      const added: PatientRecord[] = [];
      for (let i = 0; i < newCount; i++) {
        const pseudoId = `PT-${String(pseudoSeq++).padStart(5, "0")}`;
        const patient = await prisma.patient.create({
          data: {
            organizationId: organization.id,
            stationId,
            pseudoId,
            ageBand: randomChoice(["60-69", "70-79", "80-89", "90-99"]),
            careLevel: randomChoice(["要支援1", "要支援2", "要介護1", "要介護2", "要介護3", "要介護4", "要介護5"]),
            startedAt: randomDateInMonth(yearMonth),
          },
        });
        added.push({ id: patient.id, pseudoId: patient.pseudoId });
      }

      const updatedPool = remaining.concat(added);
      activePatients.set(key, updatedPool);

      if (!activePatientsByMonth.has(key)) activePatientsByMonth.set(key, new Map());
      activePatientsByMonth.get(key)!.set(yearMonth, updatedPool.slice());
    }
  }

  // ---------- Visits ----------
  for (let m = 0; m < MONTHS.length; m++) {
    const yearMonth = MONTHS[m];
    for (const [key, { id: stationId, plan }] of stations) {
      const isAnomalyMonth = key === "sendai" && m === MONTHS.length - 1 && plan.anomalyLastMonth;
      const utilization = isAnomalyMonth ? plan.anomalyLastMonth!.utilization : plan.utilizationBaseline;
      const standardMinutes = plan.nurseCount * STANDARD_VISIT_MINUTES_PER_DAY * STANDARD_WORKING_DAYS_PER_MONTH;
      const targetMinutes = Math.round((standardMinutes * utilization) / 100);
      const visitCount = Math.round(targetMinutes / 60);

      const nurses = employeesByStation.get(key)!.filter((e) => e.type === "NURSE");
      const pool = activePatientsByMonth.get(key)?.get(yearMonth) ?? [];
      if (pool.length === 0 || nurses.length === 0) continue;

      const rows: Prisma.VisitCreateManyInput[] = [];
      for (let i = 0; i < visitCount; i++) {
        rows.push({
          organizationId: organization.id,
          stationId,
          patientId: randomChoice(pool).id,
          employeeId: randomChoice(nurses).id,
          visitedAt: randomDateInMonth(yearMonth),
          durationMinutes: 60,
          visitType: "通常",
        });
      }
      // createMany を1000件ずつのバッチに分割(パラメータ数上限対策)
      for (let offset = 0; offset < rows.length; offset += 1000) {
        await prisma.visit.createMany({ data: rows.slice(offset, offset + 1000) });
      }
    }
  }

  // ---------- Referral Sources / Sales Activities ----------
  const referralSourcesByStation = new Map<string, string[]>();
  for (const [key, { plan }] of stations) {
    const ids: string[] = [];
    const typeNames = ["居宅介護支援事業所", "病院", "クリニック"];
    for (let i = 0; i < 8; i++) {
      const source = await prisma.referralSource.create({
        data: {
          organizationId: organization.id,
          name: `${plan.name.slice(0, 2)}紹介元${i + 1}`,
          type: randomChoice(typeNames),
        },
      });
      ids.push(source.id);
    }
    referralSourcesByStation.set(key, ids);
  }

  for (let m = 0; m < MONTHS.length; m++) {
    const yearMonth = MONTHS[m];
    for (const [key, { id: stationId, plan }] of stations) {
      const isAnomalyMonth = key === "sendai" && m === MONTHS.length - 1 && plan.anomalyLastMonth;
      const newCount = isAnomalyMonth ? plan.anomalyLastMonth!.newPatients : plan.newPatientsBaseline;
      const activityCount = Math.max(newCount * 4, 2);
      const sourceIds = referralSourcesByStation.get(key)!;

      const rows: Prisma.SalesActivityCreateManyInput[] = [];
      for (let i = 0; i < activityCount; i++) {
        const resultedInReferral = i < newCount;
        rows.push({
          organizationId: organization.id,
          stationId,
          referralSourceId: randomChoice(sourceIds),
          activityType: randomChoice(["VISIT", "CALL", "EVENT", "MATERIAL_SENT"]),
          occurredAt: randomDateInMonth(yearMonth),
          resultedInReferral,
          referredPatientCount: resultedInReferral ? 1 : 0,
        });
      }
      await prisma.salesActivity.createMany({ data: rows });
    }
  }

  console.log("[seed] KPISnapshotを再計算しています...");
  await recomputeKpiSnapshotsForMonth(organization.id, MONTHS[MONTHS.length - 1]);

  console.log("[seed] Decision/Actionを生成しています...");
  await ensureDecisionsForOrg(organization.id, MONTHS[MONTHS.length - 1]);

  console.log("\n[seed] 完了しました。");
  console.log(`  組織: ${organization.name} (${organization.id})`);
  console.log(`  ログイン: ${owner.email} / uchi-os-demo-2026 (Owner)`);
  console.log(`  ログイン: sendai-manager@uchi-os-demo.jp / uchi-os-demo-2026 (仙台東 Station Manager)`);
  console.log(`  最新月: ${MONTHS[MONTHS.length - 1]}`);
}

main()
  .catch((error) => {
    console.error("[seed] 失敗しました:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
