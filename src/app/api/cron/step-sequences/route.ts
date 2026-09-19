import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/crm/cronAuth";
import { runStepSequenceDelivery } from "@/lib/crm/stepSequence";

export const dynamic = "force-dynamic";

// Vercel Cron等から1日1回以上呼び出してください。
// Authorization: Bearer <CRON_SECRET>
export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runStepSequenceDelivery();
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return POST(request);
}
