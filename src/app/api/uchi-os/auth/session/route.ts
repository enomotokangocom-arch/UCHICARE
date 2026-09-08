import { NextResponse } from "next/server";
import { getSession } from "@/server/uchi-os/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
      organizationId: session.organizationId,
      stationId: session.stationId,
    },
  });
}
