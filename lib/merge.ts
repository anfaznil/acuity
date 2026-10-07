// Pure merge of two copies of the app state (e.g. this device vs. the cloud).
// Shared by the browser and the /api/sync route.
import type { CardSet, Profile, State } from "./store";

const TOMBSTONE_TTL = 180 * 24 * 60 * 60 * 1000; // forget deletions after ~6 months

const ver = (s: CardSet) => s.rev ?? s.updatedAt ?? 0;

export function mergeStates(a: State, b: State): State {
  const deleted: Record<string, number> = { ...(a.deleted ?? {}) };
  for (const [id, t] of Object.entries(b.deleted ?? {})) deleted[id] = Math.max(deleted[id] ?? 0, t);
  const cutoff = Date.now() - TOMBSTONE_TTL;
  for (const [id, t] of Object.entries(deleted)) if (t < cutoff) delete deleted[id];

  // Per set: the most recently modified copy wins; a newer deletion beats it.
  const byId = new Map<string, CardSet>();
  for (const s of [...(a.sets ?? []), ...(b.sets ?? [])]) {
    const cur = byId.get(s.id);
    if (!cur || ver(s) > ver(cur)) byId.set(s.id, s);
  }
  const sets = [...byId.values()]
    .filter((s) => !(deleted[s.id] !== undefined && deleted[s.id] >= ver(s)))
    .sort((x, y) => y.createdAt - x.createdAt);

  return { sets, profile: mergeProfile(a.profile, b.profile), deleted };
}

function mergeProfile(a: Profile, b: Profile): Profile {
  if (!a) return b;
  if (!b) return a;
  const newer = (a.rev ?? 0) >= (b.rev ?? 0) ? a : b;
  const older = newer === a ? b : a;
  const la = a.lastActive ?? "";
  const lb = b.lastActive ?? "";
  // Counters only ever grow, so the larger value is the most complete one.
  const merged: Profile = {
    ...older,
    ...newer,
    xp: Math.max(a.xp, b.xp),
    totalCorrect: Math.max(a.totalCorrect, b.totalCorrect),
    sessions: Math.max(a.sessions, b.sessions),
    achievements: [...new Set([...(a.achievements ?? []), ...(b.achievements ?? [])])],
    lastActive: la >= lb ? a.lastActive : b.lastActive,
    streak: la === lb ? Math.max(a.streak, b.streak) : la > lb ? a.streak : b.streak,
    rev: Math.max(a.rev ?? 0, b.rev ?? 0) || undefined,
  };
  const da = a.todayDate ?? "";
  const db = b.todayDate ?? "";
  if (da === db) merged.todayXp = Math.max(a.todayXp, b.todayXp);
  else {
    const later = da > db ? a : b;
    merged.todayDate = later.todayDate;
    merged.todayXp = later.todayXp;
  }
  return merged;
}

/** Cheap identity of a state's contents: equal fingerprints mean nothing needs writing. */
export function fingerprint(s: State | null | undefined): string {
  if (!s) return "";
  const sets = (s.sets ?? []).map((x) => `${x.id}:${x.rev ?? x.updatedAt ?? 0}`).sort();
  const deleted = Object.entries(s.deleted ?? {}).map(([id, t]) => `${id}:${t}`).sort();
  const p = s.profile ?? ({} as Profile);
  const profile = [p.xp, p.streak, p.lastActive, p.todayXp, p.todayDate, p.dailyGoal, p.totalCorrect, p.sessions, [...(p.achievements ?? [])].sort().join(","), p.rev];
  return JSON.stringify([sets, deleted, profile]);
}
