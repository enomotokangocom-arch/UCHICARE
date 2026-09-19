import type { Notification } from "@prisma/client";
import { prisma } from "./prisma";

// 通知プロバイダーの抽象化。
// 将来的にメール / LINE WORKS / Slack 等を追加する場合は
// NotificationProvider を実装して providers 配列に追加してください。
export interface NotificationProvider {
  name: string;
  isConfigured(): boolean;
  send(notification: Notification): Promise<void>;
}

const consoleProvider: NotificationProvider = {
  name: "console",
  isConfigured: () => true,
  async send(notification) {
    // 開発環境用フォールバック。本番ではSlack等のプロバイダーに置き換えてください。
    console.log(`[Notification] ${notification.type}: ${notification.title}`);
  },
};

const slackProvider: NotificationProvider = {
  name: "slack",
  isConfigured: () => Boolean(process.env.SLACK_WEBHOOK_URL),
  async send(notification) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `*${notification.title}*\n${notification.body ?? ""}` }),
    });
  },
};

// メール / LINE WORKS は将来の接続先として、設定時のみ有効になるプレースホルダーです。
const emailProvider: NotificationProvider = {
  name: "email",
  isConfigured: () => Boolean(process.env.NOTIFICATION_EMAIL_TO),
  async send() {
    // TODO: 実際のメール送信サービス(SES/SendGrid等)と接続してください。
  },
};

const providers: NotificationProvider[] = [consoleProvider, slackProvider, emailProvider];

export async function dispatchNotification(notification: Notification): Promise<void> {
  const active = providers.filter((p) => p.isConfigured());
  let succeeded = false;
  for (const provider of active) {
    try {
      await provider.send(notification);
      succeeded = true;
    } catch (err) {
      console.error(`Notification provider "${provider.name}" failed`, err instanceof Error ? err.message : err);
    }
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { status: succeeded ? "SENT" : "FAILED", sentAt: succeeded ? new Date() : null },
  });
}
