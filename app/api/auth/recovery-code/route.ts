import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, newRecoveryCode, verifyPassword, type UserRecord } from "@/lib/server/auth";
import { readJson, userPath, writeJson } from "@/lib/server/db";

export const runtime = "nodejs";

// Signed in + current password → a new recovery code (the old one stops working).
export async function POST(req: NextRequest) {
  const username = await getSessionUser(req);
  if (!username) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const user = await readJson<UserRecord>(userPath(username));
  if (!user || !(await verifyPassword(String(body.password ?? ""), user.data))) {
    return NextResponse.json({ error: "That password isn't right." }, { status: 401 });
  }

  const { code, recoverySalt, recoveryHash } = await newRecoveryCode();
  try {
    await writeJson(userPath(username), { ...user.data, recoverySalt, recoveryHash }, { ifMatch: user.etag });
  } catch {
    return NextResponse.json({ error: "Something changed. Please try again." }, { status: 409 });
  }
  return NextResponse.json({ recoveryCode: code });
}
