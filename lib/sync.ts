"use client";

import { useSyncExternalStore } from "react";
import { applyRemote, clearLocal, getState, onLocalChange } from "./store";
import { mergeStates } from "./merge";

export type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";
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
let inFlight = false;
let pending = false;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Push local state to the cloud, merge with what's there, and adopt the result. */
export async function syncNow(): Promise<boolean> {
  if (!account.username) return false;
  if (inFlight) {
    pending = true;
    return false;
  }
  inFlight = true;
  pending = false;
  update({ status: "syncing" });
  let ok = false;
  try {
    const res = await fetch("/api/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: getState() }),
    });
    if (res.status === 401) {
      update({ username: null, status: "idle" });
    } else if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      update({ status: "error", error: data.error || `Sync failed (${res.status})` });
    } else {
      const { state } = await res.json();
      // Re-merge with local in case something changed while the request was in flight.
      applyRemote(mergeStates(getState(), state));
      update({ status: "synced", lastSynced: Date.now(), error: undefined });
      ok = true;
    }
  } catch {
    update({ status: "offline", error: "You're offline. Changes will sync when you reconnect." });
  } finally {
    inFlight = false;
  }
  if (pending) schedule(300);
  return ok;
}

function schedule(ms = 1500) {
  if (!account.username) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, ms);
}

let started = false;
/** Called once on app start: find out who's signed in and keep the cloud copy in sync. */
export async function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  onLocalChange(() => schedule());
  const refresh = () => {
    if (document.visibilityState === "visible") void syncNow();
  };
  window.addEventListener("focus", refresh);
  window.addEventListener("online", refresh);
  document.addEventListener("visibilitychange", refresh);
  setInterval(refresh, 60_000);

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
export async function authenticate(mode: "login" | "signup", username: string, password: string): Promise<string | null> {
  const res = await fetch(`/api/auth/${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }).catch(() => null);
  if (!res) return "Couldn't reach the server. Check your connection.";
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return data.error || `Something went wrong (${res.status})`;
  update({ username: data.username, status: "idle", error: undefined });
  // Anything made on this device before signing in is merged into the account.
  await syncNow();
  return null;
}

/** Returns false (and stays signed in) if unsynced changes couldn't be saved, unless forced. */
export async function signOut(force = false): Promise<boolean> {
  while (inFlight) await new Promise((r) => setTimeout(r, 100));
  if (!force && !(await syncNow())) return false;
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  update({ username: null, status: "idle", lastSynced: undefined, error: undefined });
  clearLocal();
  return true;
}
