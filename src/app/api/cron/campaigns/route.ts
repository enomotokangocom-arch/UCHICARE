import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/crm/cronAuth";
import { dispatchDueCampaigns } from "@/lib/crm/campaigns";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await dispatchDueCampaigns();
  return NextResponse.json({ results });
}

export async function GET(request: Request) {
  return POST(request);
}
