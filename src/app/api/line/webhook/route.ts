import { NextResponse } from "next/server";
import { prisma } from "@/lib/crm/prisma";
import { verifyLineSignature } from "@/lib/crm/line/signature";
import { handleFollow, handleUnfollow, handlePostback, handleTextMessage } from "@/lib/crm/line/onboarding";
import { rateLimit, getRequestIp } from "@/lib/crm/rateLimit";

export const dynamic = "force-dynamic";

interface LineWebhookEvent {
  type: string;
  webhookEventId?: string;
  replyToken?: string;
  timestamp: number;
  source?: { type: string; userId?: string };
  message?: { type: string; id: string; text?: string };
  postback?: { data: string };
  deliveryContext?: { isRedelivery?: boolean };
}

// 個人情報(LINE User ID等)を不用意にログへ出力しないよう、エラーメッセージのみ記録する
async function processEvent(event: LineWebhookEvent) {
  const lineUserId = event.source?.userId;
  if (!lineUserId || event.source?.type !== "user") return;

  const replyToken = event.replyToken ?? null;

  switch (event.type) {
    case "follow":
      await handleFollow(lineUserId, replyToken);
      break;
    case "unfollow":
      await handleUnfollow(lineUserId);
      break;
    case "postback":
      if (event.postback?.data) {
        await handlePostback(lineUserId, event.postback.data, replyToken);
      }
      break;
    case "message":
      if (event.message?.type === "text" && event.message.text) {
        await handleTextMessage(lineUserId, event.message.text, replyToken);
      }
      break;
    default:
      break;
  }
}

export async function POST(request: Request) {
  // Webhookエンドポイントへの過剰リクエストを緩和する簡易レートリミット
  const ip = getRequestIp(request);
  const limit = rateLimit(`line-webhook:${ip}`, 300, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  let signatureValid = false;
  try {
    signatureValid = verifyLineSignature(rawBody, signature);
  } catch (err) {
    console.error("LINE signature verification error", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  if (!signatureValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { events?: LineWebhookEvent[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = payload.events ?? [];

  for (const event of events) {
    // 冪等性の担保: webhookEventId をユニークキーとして先に記録し、
    // 既に処理済み(再送)であればスキップする。
    if (event.webhookEventId) {
      try {
        await prisma.lineMessage.create({
          data: {
            direction: "IN",
            messageType: event.type,
            webhookEventId: event.webhookEventId,
            content: JSON.stringify({ type: event.type }),
          },
        });
      } catch {
        // ユニーク制約違反 = 既に処理済みの重複イベント
        continue;
      }
    }

    try {
      await processEvent(event);
    } catch (err) {
      console.error("LINE webhook event processing failed", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ ok: true });
}
