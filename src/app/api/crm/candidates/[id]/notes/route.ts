import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";
import { recordCandidateEvent } from "@/lib/crm/events";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  activityType: z.enum(["CONTACT", "CALL", "EMAIL", "NOTE", "OTHER"]).default("NOTE"),
  note: z.string().min(1).max(3000),
});

// スタッフによる手動対応記録。タイムライン(CandidateEvent)にも反映され、
// 最終スタッフ接触日(lastStaffContactAt)を更新します。
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await requireSession({ requireWrite: true });
    const { id } = await params;
    const json = await request.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "内容を入力してください。" }, { status: 400 });
    }

    const activity = await prisma.recruitmentActivity.create({
      data: {
        candidateId: id,
        staffId: session.staffId,
        activityType: parsed.data.activityType,
        note: parsed.data.note,
      },
    });

    await prisma.candidate.update({ where: { id }, data: { lastStaffContactAt: new Date() } });

    await recordCandidateEvent({
      candidateId: id,
      type: "REC_CONTACT",
      label: `スタッフ対応: ${parsed.data.activityType}`,
      payload: { note: parsed.data.note },
      actorType: "STAFF",
      actorStaffId: session.staffId,
    });

    return NextResponse.json({ activity });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
