import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/crm/cronAuth";
import { runRehearingCheck } from "@/lib/crm/rehearing";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runRehearingCheck();
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return POST(request);
}
