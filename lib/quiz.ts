import type { Card } from "./store";

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  const m = a.length,
    n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** Returns "correct" | "close" | "wrong" for a typed answer. */
export function grade(input: string, answer: string): "correct" | "close" | "wrong" {
  const a = normalize(input);
  const b = normalize(answer);
  if (!a) return "wrong";
  if (a === b) return "correct";
  const dist = levenshtein(a, b);
  const tol = Math.max(1, Math.floor(b.length * 0.15));
  if (dist <= tol) return "correct";
  // Long answers: accept if most key words are present
  const words = b.split(" ").filter((w) => w.length > 3);
  if (words.length >= 4) {
    const got = words.filter((w) => a.includes(w)).length;
    if (got / words.length >= 0.7) return "correct";
    if (got / words.length >= 0.45) return "close";
  }
  if (dist <= tol * 2 + 1) return "close";
  return "wrong";
}

export type Direction = "term" | "definition"; // what is shown as the prompt

export function promptOf(c: Card, dir: Direction) {
  return dir === "term" ? c.term : c.definition;
}
export function answerOf(c: Card, dir: Direction) {
  return dir === "term" ? c.definition : c.term;
}

export function choicesFor(card: Card, all: Card[], dir: Direction, n = 4): string[] {
  const correct = answerOf(card, dir);
  const pool = shuffle(all.filter((c) => c.id !== card.id && answerOf(c, dir) !== correct)).map((c) =>
    answerOf(c, dir)
  );
  const unique = Array.from(new Set(pool)).slice(0, n - 1);
  return shuffle([correct, ...unique]);
}

export function formatTime(ms: number) {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function pickWeighted(cards: Card[], count: number): Card[] {
  // Prefer cards with lower mastery
  const scored = cards.map((c) => ({ c, w: Math.random() * (6 - c.mastery) + (c.starred ? 1 : 0) }));
  return scored
    .sort((a, b) => b.w - a.w)
    .slice(0, count)
    .map((x) => x.c);
}
