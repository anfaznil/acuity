// Owner-only fallback for when someone forgets their password AND loses their recovery code.
//
//   node --env-file=.env.local scripts/reset-password.mjs <username>
//
// Sets a new random password and recovery code, signs the user out everywhere,
// and prints both so you can pass them on. Needs BLOB_READ_WRITE_TOKEN (from `vercel env pull`).
import { get, put } from "@vercel/blob";
import { randomBytes, randomInt, scryptSync } from "node:crypto";

const username = String(process.argv[2] ?? "").trim().toLowerCase();
if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
  console.error("Usage: node --env-file=.env.local scripts/reset-password.mjs <username>");
  process.exit(1);
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN is missing. Run `npx vercel env pull .env.local` first.");
  process.exit(1);
}

// Same scheme as lib/server/auth.ts: scrypt, 16-byte salt, 64-byte hash, base64.
const hash = (secret) => {
  const salt = randomBytes(16);
  return { salt: salt.toString("base64"), hash: scryptSync(secret, salt, 64).toString("base64") };
};
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const pick = (n) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const path = `users/${username}.json`;
const res = await get(path, { access: "private", useCache: false }).catch(() => null);
if (!res || res.statusCode !== 200) {
  console.error(`No account named "${username}".`);
  process.exit(1);
}
const user = JSON.parse(await new Response(res.stream).text());

const password = `${pick(4)}-${pick(4)}-${pick(4)}`.toLowerCase();
const code = pick(16);
const pw = hash(password);
const rc = hash(code);
await put(
  path,
  JSON.stringify({ ...user, salt: pw.salt, hash: pw.hash, recoverySalt: rc.salt, recoveryHash: rc.hash, sv: (user.sv ?? 0) + 1 }),
  {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    ifMatch: res.blob.etag.replace(/^W\//, ""),
  }
);

console.log(`Reset @${username}. They've been signed out on every device.\n`);
console.log(`  Temporary password: ${password}`);
console.log(`  New recovery code:  ${code.match(/.{4}/g).join("-")}\n`);
console.log("Ask them to sign in and save the recovery code. Their sets and progress are untouched.");
