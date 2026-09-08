import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/uchi-os/db/client";
import { verifyPassword } from "@/server/uchi-os/auth/password";
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/server/uchi-os/auth/session";
import { apiError, handleApiError } from "@/server/uchi-os/http";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = loginSchema.parse(await request.json());

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !user.isActive) {
      return apiError("INVALID_CREDENTIALS", "メールアドレスまたはパスワードが正しくありません", 401);
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      return apiError("INVALID_CREDENTIALS", "メールアドレスまたはパスワードが正しくありません", 401);
    }

    const token = await createSessionToken({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      stationId: user.stationId,
      email: user.email,
      name: user.name,
    });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action: "user.login",
        targetType: "User",
        targetId: user.id,
      },
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
    });
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions);
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError("VALIDATION_ERROR", "入力内容を確認してください", 400);
    }
    return handleApiError(error);
  }
}
