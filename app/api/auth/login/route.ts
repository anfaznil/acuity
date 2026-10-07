import { NextResponse, type NextRequest } from "next/server";
import { fakeVerify, normalizeUsername, setSession, verifyPassword, type UserRecord } from "@/lib/server/auth";
import { readJson, userPath } from "@/lib/server/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username = normalizeUsername(body.username);
  const password = String(body.password ?? "");
  const user = username ? await readJson<UserRecord>(userPath(username)) : null;
  const ok = user ? await verifyPassword(password, user.data) : await fakeVerify();
  if (!user || !ok) {
    return NextResponse.json({ error: "Wrong username or password." }, { status: 401 });
  }
  const res = NextResponse.json({ username: user.data.username });
  setSession(res, user.data);
  return res;
}
