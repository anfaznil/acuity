"use client";

import { useSyncExternalStore } from "react";
import { applyRemote, clearLocal, getState, onLocalChange, type State } from "./store";
import { fingerprint, mergeStates } from "./merge";

export type SyncStatus = "idle" | "pending" | "syncing" | "synced" | "offline" | "error";
export type Account = {
  checked: boolean; // have we asked the server who's signed in yet?
  username: string | null;
  status: SyncStatus;
  lastSynced?: number;
  error?: string;
};

let account: Account = { checked: false, username: null, status: "idle" };
const listeners = new Set<() => void>();
const update = (patch: Partial<Account>) => {
  account = { ...account, ...patch };
  listeners.forEach((l) => l());
};

const initial: Account = { checked: false, username: null, status: "idle" };
export function useAccount() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => account,
    () => initial
  );
}

// ---------- sync engine ----------
// The free Blob plan allows ~2,000 writes/month, so: pull with reads (cheap), push only when
// there are local edits, batch edits (15s after the last one, at most every 2 min while
// studying), and flush when the app is hidden or closed.
const QUIET_MS = 15_000;
const MAX_WAIT_MS = 120_000;
const PULL_EVERY_MS = 5 * 60_000;
const KEEPALIVE_LIMIT = 60_000; // browsers cap keepalive request bodies at 64KB

let dirty = false;
let dirtySince = 0;
let inFlight = false;
let again = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function adopt(remote: State | null) {
  if (!remote) return;
  // Merge with local in case something changed while the request was in flight.
  applyRemote(mergeStates(getState(), remote));
}

async function request(method: "GET" | "PUT", keepalive = false): Promise<State | null | undefined> {
  const body = method === "PUT" ? JSON.stringify({ state: getState() }) : undefined;
  const res = await fetch("/api/sync", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body,
    cache: "no-store",
    keepalive: keepalive && !!body && body.length < KEEPALIVE_LIMIT,
  });
  if (res.status === 401) {
    update({ username: null, status: "idle" });
    return undefined;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    update({ status: "error", error: data.error || `Sync failed (${res.status})` });
    return undefined;
  }
  return data.state ?? null;
}

/**
 * Bring this device and the cloud in line. Pushes if there are local edits (or the cloud is
 * missing something this device has); otherwise it's a read-only pull.
 */
export async function syncNow(opts: { keepalive?: boolean } = {}): Promise<boolean> {
  if (!account.username) return false;
  if (inFlight) {
    again = true;
    return false;
  }
  inFlight = true;
  again = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  update({ status: "syncing" });
  let ok = false;
  try {
    let remote: State | null | undefined;
    if (!dirty) {
      remote = await request("GET");
      if (remote !== undefined) {
        const merged = remote ? mergeStates(getState(), remote) : getState();
        // This device has something the cloud lacks (e.g. made before signing in) → push.
        if (fingerprint(merged) !== fingerprint(remote)) dirty = true;
        else adopt(remote);
      }
    }
    if (dirty) {
      const pushedAt = Date.now();
      remote = await request("PUT", opts.keepalive);
      if (remote !== undefined) {
        adopt(remote);
        // Edits made while the request was in flight stay dirty for the next round.
        if (dirtySince <= pushedAt) dirty = false;
      }
    }
    if (remote !== undefined) {
      update({ status: dirty ? "pending" : "synced", lastSynced: Date.now(), error: undefined });
      ok = true;
    }
  } catch {
    update({ status: "offline", error: "You're offline. Changes will sync when you reconnect." });
  } finally {
    inFlight = false;
  }
  if (again || dirty) schedule();
  return ok;
}

function schedule() {
  if (!account.username || !dirty) return;
  if (timer) clearTimeout(timer);
  const wait = Math.max(0, Math.min(QUIET_MS, dirtySince + MAX_WAIT_MS - Date.now()));
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, wait);
}

let started = false;
/** Called once on app start: find out who's signed in and keep the cloud copy in sync. */
export async function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  onLocalChange(() => {
    if (!dirty) dirtySince = Date.now();
    dirty = true;
    if (account.username && account.status !== "syncing") update({ status: "pending" });
    schedule();
  });
  const pull = () => {
    if (document.visibilityState === "visible") void syncNow();
  };
  const flush = () => {
    if (dirty) void syncNow({ keepalive: true });
  };
  window.addEventListener("focus", pull);
  window.addEventListener("online", pull);
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => (document.visibilityState === "hidden" ? flush() : pull()));
  setInterval(pull, PULL_EVERY_MS);

  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const { username } = await res.json();
    update({ checked: true, username: username ?? null });
    if (username) void syncNow();
  } catch {
    update({ checked: true });
  }
}

// ---------- account actions ----------
type AuthResult = { error?: string; recoveryCode?: string };

async function post(path: string, body: unknown): Promise<{ ok: boolean; data: Record<string, string> }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res) return { ok: false, data: { error: "Couldn't reach the server. Check your connection." } };
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.error) data.error = `Something went wrong (${res.status})`;
  return { ok: res.ok, data };
}

async function signedIn(username: string) {
  update({ username, status: "idle", error: undefined });
  // Anything made on this device before signing in is merged into the account.
  await syncNow();
}

export async function authenticate(mode: "login" | "signup", username: string, password: string): Promise<AuthResult> {
  const { ok, data } = await post(`/api/auth/${mode}`, { username, password });
  if (!ok) return { error: data.error };
  await signedIn(data.username);
  return { recoveryCode: data.recoveryCode };
}

export async function resetPassword(username: string, code: string, password: string): Promise<AuthResult> {
  const { ok, data } = await post("/api/auth/reset", { username, code, password });
  if (!ok) return { error: data.error };
  await signedIn(data.username);
  return { recoveryCode: data.recoveryCode };
}

export async function createRecoveryCode(password: string): Promise<AuthResult> {
  const { ok, data } = await post("/api/auth/recovery-code", { password });
  return ok ? { recoveryCode: data.recoveryCode } : { error: data.error };
}

/** Returns false (and stays signed in) if unsynced changes couldn't be saved, unless forced. */
export async function signOut(force = false): Promise<boolean> {
  while (inFlight) await new Promise((r) => setTimeout(r, 100));
  if (!force && !(await syncNow())) return false;
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  dirty = false;
  update({ username: null, status: "idle", lastSynced: undefined, error: undefined });
  clearLocal();
  return true;
}
