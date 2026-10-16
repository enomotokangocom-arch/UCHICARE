// セッショントークン（署名付き JWT）。proxy.ts からも使うため Next の API に依存しない。
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "../domain/types";

export const SESSION_COOKIE = "mos_session";
export const SESSION_HOURS = 8;

export type SessionPayload = { userId: string; role: Role };

function key(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload, secret: string, now = new Date()): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(now.getTime() / 1000) + SESSION_HOURS * 3600)
    .sign(key(secret));
}

export async function verifySession(token: string | undefined, secret: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    const role = payload.role;
    if (!payload.sub || (role !== "ADMIN" && role !== "MANAGER" && role !== "STAFF")) return null;
    return { userId: payload.sub, role };
  } catch {
    return null;
  }
}
