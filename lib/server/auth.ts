import "server-only";
import { createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextRequest, NextResponse } from "next/server";
import { readJson, userPath } from "./db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "acuity_session";
const SESSION_DAYS = 365;

export type UserRecord = {
  username: string;
  salt: string;
  hash: string;
  createdAt: number;
  recoverySalt?: string;
  recoveryHash?: string;
  sv?: number; // session version: bumping it signs out every device
};

export function normalizeUsername(raw: unknown): string | null {
  const u = String(raw ?? "").trim().toLowerCase();
  return /^[a-z0-9_.-]{3,32}$/.test(u) ? u : null;
}

// ---------- secrets (passwords and recovery codes) ----------
async function hashSecret(secret: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(secret, salt, 64);
  return { salt: salt.toString("base64"), hash: hash.toString("base64") };
}

async function verifySecret(secret: string, salt: string, hash: string) {
  const got = await scrypt(secret, Buffer.from(salt, "base64"), 64);
  const expected = Buffer.from(hash, "base64");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export const hashPassword = hashSecret;
export const verifyPassword = (password: string, user: UserRecord) => verifySecret(password, user.salt, user.hash);

/** Burn the same time as a real check, so unknown usernames aren't distinguishable by timing. */
export async function fakeVerify() {
  await scrypt("x", randomBytes(16), 64);
  return false;
}

// 16 chars from an unambiguous alphabet (no 0/O, 1/I/L) ≈ 79 bits, shown as XXXX-XXXX-XXXX-XXXX.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const normalizeCode = (raw: unknown) => String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export async function newRecoveryCode() {
  const raw = Array.from({ length: 16 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  const { salt, hash } = await hashSecret(raw);
  return { code: raw.match(/.{4}/g)!.join("-"), recoverySalt: salt, recoveryHash: hash };
}

export function verifyRecoveryCode(code: unknown, user: UserRecord) {
  const c = normalizeCode(code);
  if (!user.recoverySalt || !user.recoveryHash || c.length !== 16) return fakeVerify();
  return verifySecret(c, user.recoverySalt, user.recoveryHash);
}

// ---------- sessions ----------
function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET is missing or too short");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

// Stateless session: base64url({u, sv, exp}).signature
export function setSession(res: NextResponse, user: UserRecord) {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = Buffer.from(JSON.stringify({ u: user.username, sv: user.sv ?? 0, exp })).toString("base64url");
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

function readSession(req: NextRequest): { u: string; sv: number } | null {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { u, sv, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof u === "string" && exp > Date.now() ? { u, sv: sv ?? 0 } : null;
  } catch {
    return null;
  }
}

/** The signed-in user, or null if there's no valid session or it was revoked by a password reset. */
export async function getSessionUser(req: NextRequest): Promise<string | null> {
  const s = readSession(req);
  if (!s) return null;
  const user = await readJson<UserRecord>(userPath(s.u));
  return user && (user.data.sv ?? 0) === s.sv ? s.u : null;
}
