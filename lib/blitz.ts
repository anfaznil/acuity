import type { BestKey } from "./store";

export const BLITZ_OPTIONS = [30, 60, 120, 180, 300] as const;

/** A comfortable default: roughly enough time to see each card a couple of times. */
export function suggestedSeconds(cardCount: number) {
  return cardCount <= 15 ? 60 : cardCount <= 30 ? 120 : cardCount <= 50 ? 180 : 300;
}

/** Records are kept per timer; the 1-minute record keeps its original "blitz" key. */
export const blitzKey = (seconds: number): BestKey => (seconds === 60 ? "blitz" : `blitz_${seconds}`);

export const formatSeconds = (s: number) => (s < 60 ? `${s} sec` : `${s / 60} min`);
