import { prisma } from "@/server/uchi-os/db/client";
import { postSlackMessage } from "./slack";

const OPEN_ALERT_STATUSES = ["OPEN", "ACKNOWLEDGED"] as const;
const MAX_HIGHLIGHTED_ALERTS = 5;

export async function composeDailyDigest(organizationId: string): Promise<string> {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { name: true },
  });

  const [criticalCount, warningCount, pendingActionCount, highlightedAlerts] = await Promise.all([
    prisma.alert.count({ where: { organizationId, status: { in: [...OPEN_ALERT_STATUSES] }, severity: "CRITICAL" } }),
    prisma.alert.count({ where: { organizationId, status: { in: [...OPEN_ALERT_STATUSES] }, severity: "WARNING" } }),
    prisma.action.count({ where: { organizationId, status: "AI_RECOMMENDED" } }),
    prisma.alert.findMany({
      where: { organizationId, status: { in: [...OPEN_ALERT_STATUSES] }, severity: { in: ["CRITICAL", "WARNING"] } },
      orderBy: [{ severity: "asc" }, { detectedAt: "desc" }], // CRITICAL(enum順でWARNINGより前)を先に表示
      take: MAX_HIGHLIGHTED_ALERTS,
      select: { ruleCode: true, title: true },
    }),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    `📊 [${organization.name}] 日次レポート (${today})`,
    "",
    `CRITICAL Alert: ${criticalCount}件`,
    `WARNING Alert: ${warningCount}件`,
    `AI提案待ちAction: ${pendingActionCount}件`,
  ];

  if (highlightedAlerts.length > 0) {
    lines.push("", "主要Alert:");
    for (const alert of highlightedAlerts) {
      lines.push(`- ${alert.ruleCode} ${alert.title}`);
    }
  }

  return lines.join("\n");
}

/** メール送信は未実装(Phase4時点でメールプロバイダ未設定)。宛先が設定されていればログにのみ記録する。 */
function logDigestEmailFallback(recipients: string[], digest: string): void {
  console.warn(
    `[uchi-os] dailyDigestEnabled but no email provider is configured. Would send to: ${recipients.join(", ")}\n${digest}`,
  );
}

export async function sendDailyDigest(organizationId: string): Promise<void> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { dailyDigestEnabled: true, slackWebhookUrl: true, digestEmailRecipients: true },
  });
  if (!organization?.dailyDigestEnabled) return;

  const digest = await composeDailyDigest(organizationId);

  if (organization.slackWebhookUrl) {
    await postSlackMessage(organization.slackWebhookUrl, digest);
  }
  if (organization.digestEmailRecipients.length > 0) {
    logDigestEmailFallback(organization.digestEmailRecipients, digest);
  }
}

/** 全組織分の日次レポートを送信する(内部cronエンドポイントから呼ばれる)。 */
export async function sendDailyDigestForAllOrganizations(): Promise<{ organizationId: string; sent: boolean }[]> {
  const organizations = await prisma.organization.findMany({
    where: { dailyDigestEnabled: true },
    select: { id: true },
  });

  const results: { organizationId: string; sent: boolean }[] = [];
  for (const organization of organizations) {
    await sendDailyDigest(organization.id);
    results.push({ organizationId: organization.id, sent: true });
  }
  return results;
}
