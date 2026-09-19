import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";
import { changeCandidateStage } from "@/lib/crm/events";
import { CANDIDATE_STAGE_ORDER } from "@/lib/crm/constants";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const schema = z.object({ stage: z.enum(CANDIDATE_STAGE_ORDER) });

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await requireSession({ requireWrite: true });
    const { id } = await params;
    const json = await request.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "ステージが不正です。" }, { status: 400 });
    }
    const candidate = await changeCandidateStage(id, parsed.data.stage, {
      staffId: session.staffId,
      actorType: "STAFF",
    });
    return NextResponse.json({ candidate });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
