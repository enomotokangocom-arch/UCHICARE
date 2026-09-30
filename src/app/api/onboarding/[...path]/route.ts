import { NextRequest } from "next/server";
import { dispatch } from "@/onboarding/server/api";
import { db, errorResponse, readJson, withActor } from "@/onboarding/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  let body: Record<string, unknown> = {};
  if (request.method !== "GET") {
    try {
      body = await readJson(request);
    } catch (e) {
      return errorResponse(e);
    }
  }
  return withActor((actor) => dispatch(db(), actor, request.method, "/" + path.join("/"), body, request.nextUrl.searchParams));
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
