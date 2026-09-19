import { NextResponse } from "next/server";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";
import { sendCampaign } from "@/lib/crm/campaigns";
import { writeAuditLog, getClientIp } from "@/lib/crm/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// 「今すぐ配信」。承認済み(APPROVED/SCHEDULED)のキャンペーンのみ配信可能。
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await requireSession({ requireAdmin: true });
    const { id } = await params;
    const result = await sendCampaign(id);

    await writeAuditLog({
      staffId: session.staffId,
      action: "CAMPAIGN_SEND",
      targetType: "Campaign",
      targetId: id,
      after: result,
      ip: getClientIp(request),
    });

    return NextResponse.json({ result });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
