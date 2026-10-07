import "server-only";
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextRequest, NextResponse } from "next/server";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "acuity_session";
const SESSION_DAYS = 365;

export type UserRecord = { username: string; salt: string; hash: string; createdAt: number };

export function normalizeUsername(raw: unknown): string | null {
  const u = String(raw ?? "").trim().toLowerCase();
  return /^[a-z0-9_.-]{3,32}$/.test(u) ? u : null;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return { salt: salt.toString("base64"), hash: hash.toString("base64") };
}

export async function verifyPassword(password: string, user: UserRecord) {
  const hash = await scrypt(password, Buffer.from(user.salt, "base64"), 64);
  const expected = Buffer.from(user.hash, "base64");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET is missing or too short");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

// Stateless session: base64url({u, exp}).signature
export function setSession(res: NextResponse, username: string) {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString("base64url");
  res.cookies.set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export function clearSession(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export function getSessionUser(req: NextRequest): string | null {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof u === "string" && exp > Date.now() ? u : null;
  } catch {
    return null;
  }
}
