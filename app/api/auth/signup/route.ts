import { NextResponse, type NextRequest } from "next/server";
import { hashPassword, normalizeUsername, setSession, type UserRecord } from "@/lib/server/auth";
import { readJson, userPath, writeJson } from "@/lib/server/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username = normalizeUsername(body.username);
  const password = String(body.password ?? "");
  if (!username) {
    return NextResponse.json({ error: "Usernames are 3–32 characters: letters, numbers, dots, dashes or underscores." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Use a password with at least 8 characters." }, { status: 400 });
  }
  if (await readJson<UserRecord>(userPath(username))) {
    return NextResponse.json({ error: "That username is taken. Try signing in instead." }, { status: 409 });
  }

  const record: UserRecord = { username, ...(await hashPassword(password)), createdAt: Date.now() };
  try {
    await writeJson(userPath(username), record, { createOnly: true });
  } catch {
    // Lost a race with another signup for the same name.
    return NextResponse.json({ error: "That username is taken. Try signing in instead." }, { status: 409 });
  }

  const res = NextResponse.json({ username });
  setSession(res, username);
  return res;
}
