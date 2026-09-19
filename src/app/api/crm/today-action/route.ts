import { NextResponse } from "next/server";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";
import { STALE_CANDIDATE_DAYS, REHEARING_RESEARCH_DAYS, REHEARING_6_12M_DAYS } from "@/lib/crm/constants";

const DAY_MS = 24 * 60 * 60 * 1000;

const candidateSelect = {
  id: true,
  name: true,
  lineDisplayName: true,
  leadStatus: true,
  leadScore: true,
  lastLineReactionAt: true,
  lastStaffContactAt: true,
  occupation: { select: { name: true } },
} as const;

export async function GET() {
  try {
    await requireSession();
    const staleThreshold = new Date(Date.now() - STALE_CANDIDATE_DAYS * DAY_MS);

    const [hotCandidates, unreadQuestions, unreadCasual, unreadVisit, staleCandidates, rehearingCandidates] =
      await Promise.all([
        prisma.candidate.findMany({
          where: { deletedAt: null, isBlocked: false, leadStatus: "LEAD_HOT" },
          select: candidateSelect,
          orderBy: { leadScore: "desc" },
          take: 20,
        }),
        prisma.notification.findMany({
          where: { type: "LINE_QUESTION", readAt: null },
          include: { candidate: { select: candidateSelect } },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.notification.findMany({
          where: { type: "CASUAL_REQUEST", readAt: null },
          include: { candidate: { select: candidateSelect } },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.notification.findMany({
          where: { type: "VISIT_REQUEST", readAt: null },
          include: { candidate: { select: candidateSelect } },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.candidate.findMany({
          where: {
            deletedAt: null,
            isBlocked: false,
            leadStatus: { in: ["LEAD_WARM", "LEAD_HOT"] },
            registeredAt: { lt: staleThreshold },
            OR: [{ lastStaffContactAt: { lt: staleThreshold } }, { lastStaffContactAt: null }],
          },
          select: candidateSelect,
          take: 20,
        }),
        prisma.candidate.findMany({
          where: {
            deletedAt: null,
            isBlocked: false,
            stage: "NURTURING",
            transferTiming: { in: ["TIME_RESEARCH", "TIME_6_12M"] },
          },
          select: { ...candidateSelect, transferTiming: true, registeredAt: true, lastRehearingSentAt: true },
          take: 50,
        }),
      ]);

    const now = Date.now();
    const rehearingDue = rehearingCandidates.filter((c) => {
      const thresholdDays = c.transferTiming === "TIME_RESEARCH" ? REHEARING_RESEARCH_DAYS : REHEARING_6_12M_DAYS;
      const baseline = (c.lastRehearingSentAt ?? c.registeredAt).getTime();
      return (now - baseline) / DAY_MS >= thresholdDays;
    });

    return NextResponse.json({
      hot: hotCandidates,
      lineReplies: unreadQuestions.map((n) => ({ notificationId: n.id, ...n.candidate })),
      casualRequests: unreadCasual.map((n) => ({ notificationId: n.id, ...n.candidate })),
      visitRequests: unreadVisit.map((n) => ({ notificationId: n.id, ...n.candidate })),
      stale: staleCandidates,
      rehearingDue: rehearingDue.map((c) => ({
        id: c.id,
        name: c.name,
        lineDisplayName: c.lineDisplayName,
        leadStatus: c.leadStatus,
        leadScore: c.leadScore,
        lastLineReactionAt: c.lastLineReactionAt,
        lastStaffContactAt: c.lastStaffContactAt,
        occupation: c.occupation,
      })),
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
