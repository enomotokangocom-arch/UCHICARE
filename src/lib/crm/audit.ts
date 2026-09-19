import { prisma } from "./prisma";

interface AuditLogInput {
  staffId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

// 個人情報を含む可能性のあるレコードの変更操作は必ずここを通してください。
export async function writeAuditLog(input: AuditLogInput) {
  await prisma.auditLog.create({
    data: {
      staffId: input.staffId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      before: input.before !== undefined ? JSON.stringify(input.before) : null,
      after: input.after !== undefined ? JSON.stringify(input.after) : null,
      ip: input.ip ?? null,
    },
  });
}

export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip");
}
