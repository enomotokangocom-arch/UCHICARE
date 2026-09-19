import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// 09章 Secret Management: ExternalConnectionの認証トークン等、アプリ層で暗号化してDBに保存する値に使う。
// AES-256-GCM。ENCRYPTION_KEY(任意長の文字列)をSHA-256でハッシュして32byte鍵を導出する。
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    // auth/session.ts の AUTH_SECRET と同じ方針: ローカル/デモ用フォールバック。本番では必ず設定する。
    console.warn("[uchi-os] ENCRYPTION_KEY is not set. Using an insecure development fallback key.");
    return createHash("sha256").update("uchi-os-insecure-dev-encryption-key-do-not-use-in-production").digest();
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plainText: string): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

export function decryptSecret(data: Buffer): string {
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
