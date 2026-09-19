import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/crm/cronAuth";
import { runStaleCandidateCheck } from "@/lib/crm/staleCheck";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runStaleCandidateCheck();
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return POST(request);
}
