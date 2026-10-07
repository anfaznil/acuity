import { NextResponse, type NextRequest } from "next/server";
import {
  fakeVerify,
  hashPassword,
  newRecoveryCode,
  normalizeUsername,
  setSession,
  verifyRecoveryCode,
  type UserRecord,
} from "@/lib/server/auth";
import { readJson, userPath, writeJson } from "@/lib/server/db";

export const runtime = "nodejs";

// Forgot password: username + recovery code → new password.
// The used code is replaced with a fresh one, and every other device is signed out.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username = normalizeUsername(body.username);
  const password = String(body.password ?? "");
  if (password.length < 8) {
    return NextResponse.json({ error: "Use a new password with at least 8 characters." }, { status: 400 });
  }

  const user = username ? await readJson<UserRecord>(userPath(username)) : null;
  const ok = user ? await verifyRecoveryCode(body.code, user.data) : await fakeVerify();
  if (!user || !ok) {
    return NextResponse.json({ error: "That username and recovery code don't match." }, { status: 401 });
  }

  const { code, recoverySalt, recoveryHash } = await newRecoveryCode();
  const record: UserRecord = {
    ...user.data,
    ...(await hashPassword(password)),
    recoverySalt,
    recoveryHash,
    sv: (user.data.sv ?? 0) + 1,
  };
  try {
    await writeJson(userPath(user.data.username), record, { ifMatch: user.etag });
  } catch {
    return NextResponse.json({ error: "Something changed while resetting. Please try again." }, { status: 409 });
  }

  const res = NextResponse.json({ username: record.username, recoveryCode: code });
  setSession(res, record);
  return res;
}
