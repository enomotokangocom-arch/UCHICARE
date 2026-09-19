import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

export const SESSION_COOKIE_NAME = "uchicare_crm_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8; // 8時間

export type StaffRole = "ADMIN" | "RECRUITER" | "VIEWER";

export interface SessionPayload {
  staffId: string;
  email: string;
  name: string;
  role: StaffRole;
}

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET が設定されていません。.env.local に十分な長さのランダムな文字列を設定してください。"
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.staffId === "string" &&
      typeof payload.email === "string" &&
      typeof payload.name === "string" &&
      typeof payload.role === "string"
    ) {
      return {
        staffId: payload.staffId,
        email: payload.email,
        name: payload.name,
        role: payload.role as StaffRole,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = SESSION_DURATION_SECONDS;

// ロール権限: Viewerは閲覧のみ、Recruiterは候補者操作可、Adminは全操作+マスタ管理
export const ROLE_PERMISSIONS: Record<StaffRole, { canWrite: boolean; canManageAdmin: boolean }> = {
  ADMIN: { canWrite: true, canManageAdmin: true },
  RECRUITER: { canWrite: true, canManageAdmin: false },
  VIEWER: { canWrite: false, canManageAdmin: false },
};

export function canWrite(role: StaffRole): boolean {
  return ROLE_PERMISSIONS[role].canWrite;
}

export function canManageAdmin(role: StaffRole): boolean {
  return ROLE_PERMISSIONS[role].canManageAdmin;
}
