import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { UserRole } from "@prisma/client";

export const SESSION_COOKIE_NAME = "uchi_os_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7日間

export interface SessionPayload {
  userId: string;
  organizationId: string;
  role: UserRole;
  stationId: string | null;
  email: string;
  name: string;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // Phase1のローカル/デモ用フォールバック。本番運用では必ずAUTH_SECRETを設定する(09章 Secret Management)。
    console.warn(
      "[uchi-os] AUTH_SECRET is not set. Using an insecure development fallback secret.",
    );
    return new TextEncoder().encode("uchi-os-insecure-dev-secret-do-not-use-in-production");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.organizationId !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      organizationId: payload.organizationId,
      role: payload.role as UserRole,
      stationId: typeof payload.stationId === "string" ? payload.stationId : null,
      email: payload.email,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

/** Server Components / Route Handlers から現在のセッションを取得する。未ログインなら null。 */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
