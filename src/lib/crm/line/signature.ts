import { createHmac, timingSafeEqual } from "crypto";

// LINE Webhook署名検証 (X-Line-Signature ヘッダー)
// https://developers.line.biz/ja/reference/messaging-api/#signature-validation
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    throw new Error("LINE_CHANNEL_SECRET が設定されていません。");
  }
  if (!signature) return false;

  const expected = createHmac("sha256", channelSecret).update(rawBody).digest("base64");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;

  return timingSafeEqual(expectedBuf, actualBuf);
}
