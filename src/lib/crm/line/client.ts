// LINE Messaging API クライアント。
// Channel Access Token は環境変数からのみ読み込み、ログに出力しないでください。

const LINE_API_BASE = "https://api.line.me/v2/bot";

export interface LineQuickReply {
  items: Array<{
    type: "action";
    action: { type: "postback"; label: string; data: string; displayText?: string };
  }>;
}

export type LineMessage =
  | { type: "text"; text: string; quickReply?: LineQuickReply }
  | {
      type: "template";
      altText: string;
      template: {
        type: "buttons" | "confirm";
        text: string;
        actions: Array<{ type: "message" | "postback" | "uri"; label: string; text?: string; data?: string; uri?: string }>;
      };
    };

function getAccessToken(): string {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "LINE_CHANNEL_ACCESS_TOKEN が設定されていません。LINE配信機能を使うには環境変数を設定してください。"
    );
  }
  return token;
}

async function callLineApi(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    // LINE User ID等の個人情報を含む可能性があるため詳細はログに出さない
    throw new Error(`LINE API error (${res.status}): ${errorBody.slice(0, 300)}`);
  }
}

export async function replyMessage(replyToken: string, messages: LineMessage[]): Promise<void> {
  await callLineApi("/message/reply", { replyToken, messages });
}

export async function pushMessage(to: string, messages: LineMessage[]): Promise<void> {
  await callLineApi("/message/push", { to, messages });
}

export async function multicastMessage(to: string[], messages: LineMessage[]): Promise<void> {
  if (to.length === 0) return;
  // LINE APIの上限(1回500件)に合わせてチャンク分割
  const chunkSize = 500;
  for (let i = 0; i < to.length; i += chunkSize) {
    await callLineApi("/message/multicast", { to: to.slice(i, i + chunkSize), messages });
  }
}

export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

export async function getUserProfile(lineUserId: string): Promise<LineProfile | null> {
  const res = await fetch(`${LINE_API_BASE}/profile/${encodeURIComponent(lineUserId)}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function linkRichMenuToUser(lineUserId: string, richMenuId: string): Promise<void> {
  const res = await fetch(
    `${LINE_API_BASE}/user/${encodeURIComponent(lineUserId)}/richmenu/${encodeURIComponent(richMenuId)}`,
    { method: "POST", headers: { Authorization: `Bearer ${getAccessToken()}` } }
  );
  if (!res.ok) {
    throw new Error(`Rich menu link failed (${res.status})`);
  }
}

export function isLineConfigured(): boolean {
  return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET);
}
