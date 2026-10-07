import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return NextResponse.json({ username: await getSessionUser(req) }, { headers: { "Cache-Control": "no-store" } });
}
