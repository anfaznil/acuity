"use client";

import { useSyncExternalStore } from "react";

export type Card = {
  id: string;
  term: string;
  definition: string;
  mastery: number; // 0–5
  correct: number;
  wrong: number;
  starred?: boolean;
};

export type CardSet = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  color: number; // index into palette
  cards: Card[];
  source?: string;
  createdAt: number;
  updatedAt: number;
  lastStudied?: number;
  best: Best;
  blitzSeconds?: number; // last Blitz timer chosen for this set
  rev?: number; // last local modification (ms), used to merge across devices
};

// Personal bests. Blitz records are per timer: "blitz" is the 60s record, "blitz_120" is 2 min, etc.
export type BestKey = "match" | "test" | "blitz" | `blitz_${number}`;
export type Best = { [K in BestKey]?: number };

export type Profile = {
  xp: number;
  streak: number;
  lastActive?: string; // YYYY-MM-DD
  todayXp: number;
  todayDate?: string;
  dailyGoal: number;
  achievements: string[];
  totalCorrect: number;
  sessions: number;
  rev?: number;
};

export type State = {
  sets: CardSet[];
  profile: Profile;
  deleted?: Record<string, number>; // set id → deletion time, so deletes sync across devices
};

export type XpEvent = { id: number; amount: number; label?: string };
export type Notice =
  | { kind: "level"; level: number }
  | { kind: "achievement"; id: string }
  | { kind: "goal" };

const KEY = "acuity:v1";

const defaultProfile: Profile = {
  xp: 0,
  streak: 0,
  todayXp: 0,
  dailyGoal: 150,
  achievements: [],
  totalCorrect: 0,
  sessions: 0,
};

let state: State = { sets: [], profile: { ...defaultProfile } };
let loaded = false;
const listeners = new Set<() => void>();
const xpListeners = new Set<(e: XpEvent) => void>();
const noticeListeners = new Set<(n: Notice) => void>();
const changeListeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      state = { sets: parsed.sets ?? [], profile: { ...defaultProfile, ...parsed.profile }, deleted: parsed.deleted ?? {} };
    }
  } catch {
    /* ignore */
  }
  rollDay();
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

function set(next: State) {
  // Stamp anything that changed so other devices can tell which copy is newer.
  const now = Date.now();
  const prev = new Map(state.sets.map((s) => [s.id, s]));
  next = { ...next, sets: next.sets.map((s) => (prev.get(s.id) === s ? s : { ...s, rev: now })) };
  if (next.profile !== state.profile) next = { ...next, profile: { ...next.profile, rev: now } };
  state = next;
  emit();
  changeListeners.forEach((l) => l());
}

/** Fires after any local edit (not after applyRemote). Used by the sync engine. */
export function onLocalChange(fn: () => void) {
  changeListeners.add(fn);
  return () => {
    changeListeners.delete(fn);
  };
}

/** Replace local state with a merged copy from the server, without re-stamping it. */
export function applyRemote(next: State) {
  load();
  state = { sets: next.sets ?? [], profile: { ...defaultProfile, ...next.profile }, deleted: next.deleted ?? {} };
  rollDay();
  emit();
}

/** Wipe this browser's copy (used on sign-out so a shared device doesn't keep someone's sets). */
export function clearLocal() {
  load();
  state = { sets: [], profile: { ...defaultProfile }, deleted: {} };
  rollDay();
  emit();
}

export function getState() {
  load();
  return state;
}

const serverSnapshot: State = { sets: [], profile: defaultProfile, deleted: {} };

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(getState()),
    () => selector(serverSnapshot)
  );
}

export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function onXp(fn: (e: XpEvent) => void) {
  xpListeners.add(fn);
  return () => {
    xpListeners.delete(fn);
  };
}
export function onNotice(fn: (n: Notice) => void) {
  noticeListeners.add(fn);
  return () => {
    noticeListeners.delete(fn);
  };
}

// ---------- utils ----------
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const today = () => new Date().toLocaleDateString("en-CA");
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA");
};

function rollDay() {
  const p = state.profile;
  if (p.todayDate !== today()) {
    state = { ...state, profile: { ...p, todayXp: 0, todayDate: today() } };
  }
  if (p.lastActive && p.lastActive !== today() && p.lastActive !== yesterday() && p.streak !== 0) {
    state = { ...state, profile: { ...state.profile, streak: 0 } };
  }
}

// ---------- levels ----------
export function levelInfo(xp: number) {
  let level = 1;
  let need = 100;
  let rem = xp;
  while (rem >= need) {
    rem -= need;
    level++;
    need = 100 + (level - 1) * 60;
  }
  return { level, into: rem, need, pct: rem / need };
}

export const LEVEL_TITLES = [
  "Curious Mind",
  "Note Taker",
  "Quick Study",
  "Card Shark",
  "Memory Maker",
  "Scholar",
  "Brainiac",
  "Sage",
  "Mastermind",
  "Legend",
];
export const levelTitle = (lvl: number) => LEVEL_TITLES[Math.min(lvl - 1, LEVEL_TITLES.length - 1)];

// ---------- achievements ----------
export const ACHIEVEMENTS: Record<string, { name: string; desc: string; icon: string }> = {
  first_set: { name: "Forged", desc: "Create your first set", icon: "🔨" },
  first_session: { name: "Warm Up", desc: "Finish your first study session", icon: "🔥" },
  xp_500: { name: "Rising Star", desc: "Earn 500 XP", icon: "⭐" },
  xp_2500: { name: "Powerhouse", desc: "Earn 2,500 XP", icon: "⚡" },
  level_5: { name: "High Five", desc: "Reach level 5", icon: "🖐️" },
  streak_3: { name: "Hat Trick", desc: "3-day study streak", icon: "📅" },
  streak_7: { name: "Unstoppable", desc: "7-day study streak", icon: "🏆" },
  perfect_test: { name: "Flawless", desc: "Score 100% on a test", icon: "💯" },
  speed_match: { name: "Lightning Hands", desc: "Finish Match in under 25s", icon: "🌩️" },
  blitz_20: { name: "Blitzkrieg", desc: "20+ correct in a 1-minute Blitz", icon: "💥" },
  mastered_set: { name: "Mastery", desc: "Master every card in a set", icon: "🧠" },
  combo_10: { name: "On Fire", desc: "Hit a 10× combo", icon: "🎯" },
  goal: { name: "Goal Getter", desc: "Hit your daily XP goal", icon: "🥅" },
};

export function unlock(id: string) {
  load();
  if (state.profile.achievements.includes(id)) return;
  set({ ...state, profile: { ...state.profile, achievements: [...state.profile.achievements, id] } });
  noticeListeners.forEach((l) => l({ kind: "achievement", id }));
}

// ---------- xp ----------
let xpEventId = 0;
export function addXp(amount: number, label?: string) {
  load();
  rollDay();
  amount = Math.round(amount);
  if (amount <= 0) return;
  const p = state.profile;
  const before = levelInfo(p.xp).level;
  let streak = p.streak;
  if (p.lastActive !== today()) {
    streak = p.lastActive === yesterday() ? p.streak + 1 : 1;
  }
  const hadGoal = p.todayXp >= p.dailyGoal;
  const profile: Profile = {
    ...p,
    xp: p.xp + amount,
    todayXp: p.todayXp + amount,
    todayDate: today(),
    lastActive: today(),
    streak,
  };
  set({ ...state, profile });
  xpListeners.forEach((l) => l({ id: ++xpEventId, amount, label }));
  const after = levelInfo(profile.xp).level;
  if (after > before) noticeListeners.forEach((l) => l({ kind: "level", level: after }));
  if (!hadGoal && profile.todayXp >= profile.dailyGoal) {
    noticeListeners.forEach((l) => l({ kind: "goal" }));
    unlock("goal");
  }
  if (profile.xp >= 500) unlock("xp_500");
  if (profile.xp >= 2500) unlock("xp_2500");
  if (after >= 5) unlock("level_5");
  if (streak >= 3) unlock("streak_3");
  if (streak >= 7) unlock("streak_7");
}

export function setDailyGoal(goal: number) {
  set({ ...getState(), profile: { ...state.profile, dailyGoal: goal } });
}

// ---------- sets ----------
export function createSet(input: {
  title: string;
  description?: string;
  emoji?: string;
  source?: string;
  cards: { term: string; definition: string }[];
}): string {
  load();
  const id = uid();
  const now = Date.now();
  const s: CardSet = {
    id,
    title: input.title || "Untitled set",
    description: input.description ?? "",
    emoji: input.emoji || "📚",
    color: Math.floor(Math.random() * 6),
    source: input.source,
    cards: input.cards.map((c) => ({ id: uid(), term: c.term, definition: c.definition, mastery: 0, correct: 0, wrong: 0 })),
    createdAt: now,
    updatedAt: now,
    best: {},
  };
  set({ ...state, sets: [s, ...state.sets] });
  unlock("first_set");
  return id;
}

export function updateSet(id: string, patch: Partial<CardSet>) {
  load();
  set({
    ...state,
    sets: state.sets.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s)),
  });
}

export function deleteSet(id: string) {
  load();
  set({ ...state, sets: state.sets.filter((s) => s.id !== id), deleted: { ...state.deleted, [id]: Date.now() } });
}

export function recordAnswer(setId: string, cardId: string, correct: boolean) {
  load();
  set({
    ...state,
    profile: correct ? { ...state.profile, totalCorrect: state.profile.totalCorrect + 1 } : state.profile,
    sets: state.sets.map((s) =>
      s.id !== setId
        ? s
        : {
            ...s,
            lastStudied: Date.now(),
            cards: s.cards.map((c) =>
              c.id !== cardId
                ? c
                : {
                    ...c,
                    mastery: correct ? Math.min(5, c.mastery + 1) : Math.max(0, c.mastery - 2),
                    correct: c.correct + (correct ? 1 : 0),
                    wrong: c.wrong + (correct ? 0 : 1),
                  }
            ),
          }
    ),
  });
  const s = state.sets.find((x) => x.id === setId);
  if (s && s.cards.length >= 4 && s.cards.every((c) => c.mastery >= 4)) unlock("mastered_set");
}

export function toggleStar(setId: string, cardId: string) {
  load();
  set({
    ...state,
    sets: state.sets.map((s) =>
      s.id !== setId ? s : { ...s, cards: s.cards.map((c) => (c.id === cardId ? { ...c, starred: !c.starred } : c)) }
    ),
  });
}

export function recordBest(setId: string, key: BestKey, value: number): boolean {
  load();
  const s = state.sets.find((x) => x.id === setId);
  if (!s) return false;
  const prev = s.best[key];
  const better = prev === undefined || (key === "match" ? value < prev : value > prev);
  if (better) updateSet(setId, { best: { ...s.best, [key]: value } });
  return better;
}

export function finishSession() {
  load();
  set({ ...state, profile: { ...state.profile, sessions: state.profile.sessions + 1 } });
  unlock("first_session");
}

export function resetProgress(setId: string) {
  load();
  updateSet(setId, {
    cards: state.sets.find((s) => s.id === setId)!.cards.map((c) => ({ ...c, mastery: 0, correct: 0, wrong: 0 })),
  });
}

export function exportData(): string {
  return JSON.stringify(getState(), null, 2);
}

export function importData(json: string): number {
  load();
  const data = JSON.parse(json) as Partial<State> | CardSet;
  const incoming: CardSet[] = Array.isArray((data as State).sets)
    ? (data as State).sets
    : (data as CardSet).cards
      ? [data as CardSet]
      : [];
  const existing = new Set(state.sets.map((s) => s.id));
  const fresh = incoming.map((s) => (existing.has(s.id) ? { ...s, id: uid() } : s));
  set({ ...state, sets: [...fresh, ...state.sets] });
  return fresh.length;
}

export function masteryStats(cards: Card[]) {
  const mastered = cards.filter((c) => c.mastery >= 4).length;
  const learning = cards.filter((c) => c.mastery > 0 && c.mastery < 4).length;
  const fresh = cards.length - mastered - learning;
  return { mastered, learning, fresh, pct: cards.length ? mastered / cards.length : 0 };
}
