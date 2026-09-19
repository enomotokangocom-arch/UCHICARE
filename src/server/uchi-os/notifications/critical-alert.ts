import { prisma } from "@/server/uchi-os/db/client";
import { postSlackMessage } from "./slack";

/** 23章 通知・自動化: CRITICALなAlertが新規発生した時のみ呼ぶ(再評価による更新では呼ばない、通知の重複を防ぐため)。 */
export async function notifyCriticalAlert(
  organizationId: string,
  alert: { ruleCode: string; title: string },
): Promise<void> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, slackWebhookUrl: true, notifyOnCriticalAlert: true },
  });
  if (!organization?.notifyOnCriticalAlert || !organization.slackWebhookUrl) return;

  await postSlackMessage(
    organization.slackWebhookUrl,
    `:rotating_light: [${organization.name}] CRITICAL Alert発生 (${alert.ruleCode})\n${alert.title}`,
  );
}
