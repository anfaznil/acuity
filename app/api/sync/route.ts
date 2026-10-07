import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { BlobPreconditionFailedError, dataPath, readJson, writeJson } from "@/lib/server/db";
import { fingerprint, mergeStates } from "@/lib/merge";
import type { State } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 4_000_000;
const noStore = { "Cache-Control": "no-store" };

function unauthorized() {
  return NextResponse.json({ error: "Please sign in again." }, { status: 401, headers: noStore });
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  const doc = await readJson<State>(dataPath(user));
  return NextResponse.json({ state: doc?.data ?? null }, { headers: noStore });
}

// The client sends its whole local state; we merge it into the stored copy and return the result.
export async function PUT(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "Your library is too large to sync." }, { status: 413 });
  let incoming: State;
  try {
    incoming = JSON.parse(raw).state;
    if (!incoming || !Array.isArray(incoming.sets) || typeof incoming.profile !== "object") throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid sync payload." }, { status: 400 });
  }

  // Read → merge → conditional write; retry if another device wrote in between.
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await readJson<State>(dataPath(user));
    const merged = current ? mergeStates(current.data, incoming) : mergeStates(incoming, incoming);
    // Blob writes are the scarce resource on the free plan, so skip no-op writes.
    if (current && fingerprint(merged) === fingerprint(current.data)) {
      return NextResponse.json({ state: merged }, { headers: noStore });
    }
    try {
      await writeJson(dataPath(user), merged, current ? { ifMatch: current.etag } : { createOnly: true });
      return NextResponse.json({ state: merged }, { headers: noStore });
    } catch (err) {
      const conflict = err instanceof BlobPreconditionFailedError || (!current && /exist/i.test(String(err)));
      if (!conflict) {
        console.error("sync write failed", err);
        return NextResponse.json({ error: "Couldn't save to the cloud. Your changes are still on this device." }, { status: 502 });
      }
    }
  }
  return NextResponse.json({ error: "Sync is busy, will retry shortly." }, { status: 409 });
}
