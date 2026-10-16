// 個人情報の保護。利用者・職員の識別子は HMAC でハッシュ化し、元の値は保存しない。
import { createHmac } from "node:crypto";
import { normalizeText } from "./normalize";

export function pseudonymize(value: unknown, secret: string): string | null {
  const s = normalizeText(value);
  if (!s) return null;
  return createHmac("sha256", secret).update(s).digest("hex").slice(0, 32);
}
