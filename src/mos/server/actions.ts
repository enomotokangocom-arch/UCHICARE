"use server";
// Server Actions。各アクションの入口で requireUser により権限を確認する（画面の表示制御には依存しない）。
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { matchKey, normalizeText, parseYearMonth } from "../domain/normalize";
import { createSession, deleteSession, hashPassword, requireUser, verifyPassword } from "./auth";
import { getDb } from "./db";
import { applyHeldValues, classifyTransactions } from "./importService";
import { NEEDS_REVIEW_WHERE } from "./queries";
import { closeMonth, recalculate, reopenMonth } from "./recalc";
import { saveSetting } from "./settings";

export type ActionState = { error?: string; message?: string; errors?: string[] } | undefined;

const str = (f: FormData, k: string) => normalizeText(f.get(k) ?? "");
const optional = <T extends string>(v: string): T | null => (v ? (v as T) : null);

// ---------- 認証 ----------

export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> {
  const email = str(form, "email");
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "メールアドレスとパスワードを入力してください" };
  const user = await verifyPassword(email, password);
  if (!user) return { error: "メールアドレスまたはパスワードが正しくありません" };
  await createSession(user.id, user.role);
  await getDb().auditLog.create({ data: { userId: user.id, action: "LOGIN" } });
  redirect("/mos");
}

export async function logoutAction() {
  await deleteSession();
  redirect("/mos/login");
}

// ---------- 取引の手動分類 ----------

const CATEGORIES = ["EXPENSE", "PAYROLL", "TAX_SOCIAL", "INTERNAL_TRANSFER", "CARD_SETTLEMENT", "LOAN_PRINCIPAL", "LOAN_REPAYMENT_MIXED", "LOAN_INTEREST", "REVENUE_RECEIPT", "OTHER_INCOME", "UNCLASSIFIED"] as const;

const classifySchema = z.object({
  id: z.string().min(1),
  category: z.enum(CATEGORIES),
  accountTitle: z.string(),
  unit: z.enum(["", "HOMONKANGO", "KYOTAKU"]),
  allocation: z.enum(["", "DIRECT", "COMMON", "HQ"]),
  makeRule: z.boolean(),
});

export async function classifyTxAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN", "MANAGER"]);
  const parsed = classifySchema.safeParse({
    id: str(form, "id"),
    category: str(form, "category"),
    accountTitle: str(form, "accountTitle"),
    unit: str(form, "unit"),
    allocation: str(form, "allocation"),
    makeRule: form.get("makeRule") === "on",
  });
  if (!parsed.success) return { error: "入力内容を確認してください" };
  const v = parsed.data;
  const db = getDb();
  const tx = await db.bankTransaction.findUnique({ where: { id: v.id }, include: { account: true } });
  if (!tx) return { error: "取引が見つかりません" };
  if (tx.origin === "REAL") {
    const close = await db.monthClose.findUnique({ where: { yearMonth: tx.yearMonth } });
    if (close?.status === "CLOSED") return { error: `${tx.yearMonth} は確定済みのため変更できません` };
  }
  const needsTitle = v.category === "EXPENSE" || v.category === "PAYROLL";
  if (needsTitle && !v.accountTitle) return { error: "経費・給与には勘定科目を指定してください" };
  const account = v.accountTitle ? await db.accountTitle.findUnique({ where: { name: v.accountTitle } }) : null;
  if (v.accountTitle && !account) return { error: "勘定科目がマスタにありません" };
  const unit = optional<"HOMONKANGO" | "KYOTAKU">(v.unit);
  const allocation = needsTitle ? (optional<"DIRECT" | "COMMON" | "HQ">(v.allocation) ?? (unit ? "DIRECT" : "COMMON")) : null;
  if (allocation === "DIRECT" && !unit) return { error: "直接費にする場合は部門を指定してください" };

  await db.bankTransaction.update({
    where: { id: tx.id },
    data: {
      category: v.category,
      accountTitle: needsTitle || v.category === "LOAN_INTEREST" || v.category === "OTHER_INCOME" ? v.accountTitle || null : null,
      unit: needsTitle ? unit : null,
      allocation,
      behavior: needsTitle ? (account?.behavior ?? null) : null,
      classifiedBy: "MANUAL",
      ruleId: null,
      reviewedById: user.id,
      reviewedAt: new Date(),
    },
  });
  await db.auditLog.create({ data: { userId: user.id, action: "TX_CLASSIFIED", target: tx.id, detail: { category: v.category, accountTitle: v.accountTitle } } });

  const months = new Set([tx.yearMonth]);
  if (v.makeRule) {
    await db.classificationRule.create({
      data: {
        priority: 50,
        bank: tx.account.bank,
        direction: tx.deposit > 0 ? "IN" : "OUT",
        field: "DESCRIPTION",
        pattern: matchKey(tx.description),
        category: v.category,
        accountTitle: v.accountTitle || null,
        unit,
        allocation,
        behavior: account?.behavior ?? null,
        note: `手動分類から作成（${user.name}）`,
      },
    });
    const pending = await db.bankTransaction.findMany({ where: { origin: tx.origin, ...NEEDS_REVIEW_WHERE }, select: { id: true, yearMonth: true } });
    await classifyTransactions(db, pending.map((p) => p.id));
    for (const p of pending) months.add(p.yearMonth);
  }
  await recalculate(db, { trigger: "MANUAL", origin: tx.origin, months: [...months] });
  revalidatePath("/mos", "layout");
  return { message: "分類を保存しました" };
}

// ---------- 月次確定 ----------

export async function closeMonthAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const ym = parseYearMonth(str(form, "yearMonth"));
  if (!ym.ok) return { error: ym.reason };
  try {
    await closeMonth(getDb(), ym.value, user.id);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/mos", "layout");
  return { message: `${ym.value} を確定しました` };
}

export async function reopenMonthAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const ym = parseYearMonth(str(form, "yearMonth"));
  if (!ym.ok) return { error: ym.reason };
  try {
    await reopenMonth(getDb(), ym.value, user.id, str(form, "reason"));
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/mos", "layout");
  return { message: `${ym.value} の確定を解除しました` };
}

export async function applyHeldAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const ym = parseYearMonth(str(form, "yearMonth"));
  if (!ym.ok) return { error: ym.reason };
  try {
    await applyHeldValues(getDb(), ym.value, user.id);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/mos", "layout");
  return { message: `${ym.value} の保留中の値を反映しました` };
}

// ---------- 設定 ----------

const int = (v: string) => (/^-?\d+$/.test(v.replace(/,/g, "")) ? Number(v.replace(/,/g, "")) : NaN);

export async function saveTargetAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const ym = parseYearMonth(str(form, "yearMonth"));
  const unit = str(form, "unit");
  const metric = str(form, "metric");
  const value = int(str(form, "value"));
  if (!ym.ok) return { error: ym.reason };
  if (!["COMPANY", "HOMONKANGO", "KYOTAKU"].includes(unit) || !["REVENUE", "OPERATING_PROFIT", "VISITS"].includes(metric)) return { error: "入力内容を確認してください" };
  if (Number.isNaN(value)) return { error: "目標値は整数で入力してください" };
  const db = getDb();
  const key = { yearMonth: ym.value, unit: unit as "COMPANY", metric: metric as "REVENUE" };
  await db.target.upsert({ where: { yearMonth_unit_metric: key }, update: { value }, create: { ...key, value } });
  await db.auditLog.create({ data: { userId: user.id, action: "TARGET_SAVED", target: ym.value, detail: { unit, metric, value } } });
  await recalculate(db, { trigger: "MANUAL", months: [ym.value] });
  revalidatePath("/mos", "layout");
  return { message: "目標を保存しました" };
}

export async function saveCapacityAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const ym = parseYearMonth(str(form, "yearMonth"));
  const unit = str(form, "unit");
  const jobType = str(form, "jobType");
  const headcount = int(str(form, "headcount"));
  const hours = Number(str(form, "hours"));
  if (!ym.ok) return { error: ym.reason };
  if (!["HOMONKANGO", "KYOTAKU"].includes(unit) || !["NURSE", "PT", "OT", "ST", "CARE_MANAGER", "OTHER"].includes(jobType)) return { error: "入力内容を確認してください" };
  if (Number.isNaN(headcount) || headcount < 0 || !Number.isFinite(hours) || hours < 0) return { error: "人数・時間は0以上の数値で入力してください" };
  const db = getDb();
  const key = { yearMonth: ym.value, unit: unit as "HOMONKANGO", jobType: jobType as "NURSE" };
  const data = { headcount, availableMinutes: Math.round(hours * 60) };
  await db.staffCapacity.upsert({ where: { yearMonth_unit_jobType: key }, update: data, create: { ...key, ...data } });
  await db.auditLog.create({ data: { userId: user.id, action: "CAPACITY_SAVED", target: ym.value, detail: { unit, jobType, ...data } } });
  await recalculate(db, { trigger: "MANUAL", months: [ym.value] });
  revalidatePath("/mos", "layout");
  return { message: "稼働可能時間を保存しました" };
}

export async function saveCalcSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const tolerance = int(str(form, "tolerance"));
  if (Number.isNaN(tolerance) || tolerance < 0) return { error: "許容差は0以上の整数で入力してください" };
  const basis = (prefix: string) => {
    if (str(form, `${prefix}Method`) !== "FIXED_RATIO") return { method: "REVENUE_SHARE" as const };
    const hk = Number(str(form, `${prefix}Hk`));
    const ky = Number(str(form, `${prefix}Ky`));
    if (!(hk >= 0 && ky >= 0 && hk + ky > 0)) throw new Error("固定比率は0以上で、合計が0より大きい値にしてください");
    return { method: "FIXED_RATIO" as const, ratios: { HOMONKANGO: hk, KYOTAKU: ky } };
  };
  let allocation;
  try {
    allocation = { common: basis("common"), hq: basis("hq") };
  } catch (e) {
    return { error: (e as Error).message };
  }
  const db = getDb();
  await saveSetting(db, "tolerance", tolerance);
  await saveSetting(db, "allocation", allocation);
  await db.auditLog.create({ data: { userId: user.id, action: "SETTINGS_SAVED", detail: { tolerance, allocation } } });
  await recalculate(db, { trigger: "MANUAL" });
  revalidatePath("/mos", "layout");
  return { message: "計算設定を保存し、再計算しました" };
}

export async function saveAccountAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const name = str(form, "name");
  const section = str(form, "section");
  const behavior = str(form, "behavior");
  const allocation = str(form, "allocation");
  const sections = ["REVENUE", "REVENUE_ADJUSTMENT", "COGS", "SGA", "NON_OPERATING_INCOME", "NON_OPERATING_EXPENSE", "EXTRAORDINARY", "SUBTOTAL"];
  if (!name || !sections.includes(section)) return { error: "科目名と区分を入力してください" };
  if (behavior && !["LABOR", "FIXED", "VARIABLE"].includes(behavior)) return { error: "費用区分が不正です" };
  if (allocation && !["DIRECT", "COMMON", "HQ"].includes(allocation)) return { error: "配賦区分が不正です" };
  const db = getDb();
  const data = {
    section: section as "SGA",
    behavior: optional<"LABOR" | "FIXED" | "VARIABLE">(behavior),
    allocation: optional<"DIRECT" | "COMMON" | "HQ">(allocation),
  };
  const max = await db.accountTitle.aggregate({ _max: { sortOrder: true } });
  await db.accountTitle.upsert({ where: { name }, update: data, create: { name, ...data, sortOrder: (max._max.sortOrder ?? 0) + 10 } });
  await db.auditLog.create({ data: { userId: user.id, action: "ACCOUNT_SAVED", target: name, detail: data } });
  await recalculate(db, { trigger: "MANUAL" });
  revalidatePath("/mos", "layout");
  return { message: `科目「${name}」を保存しました` };
}

export async function toggleRuleAction(form: FormData) {
  const user = await requireUser(["ADMIN"]);
  const id = str(form, "id");
  const db = getDb();
  const rule = await db.classificationRule.findUnique({ where: { id } });
  if (!rule) return;
  await db.classificationRule.update({ where: { id }, data: { active: !rule.active } });
  await db.auditLog.create({ data: { userId: user.id, action: rule.active ? "RULE_DISABLED" : "RULE_ENABLED", target: id } });
  revalidatePath("/mos/settings");
}

export async function addUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const email = str(form, "email").toLowerCase();
  const name = str(form, "name");
  const role = str(form, "role");
  const password = String(form.get("password") ?? "");
  if (!z.email().safeParse(email).success || !name) return { error: "氏名とメールアドレスを入力してください" };
  if (!["ADMIN", "MANAGER", "STAFF"].includes(role)) return { error: "ロールを選んでください" };
  if (password.length < 10) return { error: "パスワードは10文字以上にしてください" };
  const db = getDb();
  if (await db.user.findUnique({ where: { email } })) return { error: "このメールアドレスは登録済みです" };
  const created = await db.user.create({ data: { email, name, role: role as "STAFF", passwordHash: await hashPassword(password) } });
  await db.auditLog.create({ data: { userId: user.id, action: "USER_CREATED", target: created.id, detail: { role } } });
  revalidatePath("/mos/settings");
  return { message: `${name} さんを登録しました` };
}

export async function toggleUserAction(form: FormData) {
  const user = await requireUser(["ADMIN"]);
  const id = str(form, "id");
  if (id === user.id) return; // 自分自身は無効化できない
  const db = getDb();
  const target = await db.user.findUnique({ where: { id } });
  if (!target) return;
  await db.user.update({ where: { id }, data: { active: !target.active } });
  await db.auditLog.create({ data: { userId: user.id, action: target.active ? "USER_DISABLED" : "USER_ENABLED", target: id } });
  revalidatePath("/mos/settings");
}

export async function recalcAction(): Promise<void> {
  await requireUser(["ADMIN"]);
  await recalculate(getDb(), { trigger: "MANUAL" });
  revalidatePath("/mos", "layout");
}
