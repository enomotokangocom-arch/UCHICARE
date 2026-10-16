// クライアントでも使う個人情報列の判定（サーバー側でも同じ判定で検査する）
import { PII_HEADER_KEYWORDS } from "@/mos/domain/piiKeywords";

export function isPiiHeaderClient(header: string): boolean {
  const h = header.normalize("NFKC").toLowerCase();
  return PII_HEADER_KEYWORDS.some((k) => h.includes(k.toLowerCase()));
}
