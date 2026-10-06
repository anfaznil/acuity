"use client";

import { useEffect, useRef, useState } from "react";
import { addXp, finishSession, recordAnswer, recordBest, unlock, type CardSet } from "@/lib/store";
import { formatTime, pickWeighted, shuffle } from "@/lib/quiz";
import { Results, StudyTop } from "../Study";

type Tile = { key: string; cardId: string; text: string; kind: "t" | "d" };

const PAIRS = 6;
const PENALTY = 1000;

function makeTiles(set: CardSet): Tile[] {
  const cards = pickWeighted(set.cards, Math.min(PAIRS, set.cards.length));
  return shuffle(
    cards.flatMap((c) => [
      { key: c.id + "t", cardId: c.id, text: c.term, kind: "t" as const },
      { key: c.id + "d", cardId: c.id, text: c.definition.length > 120 ? c.definition.slice(0, 117) + "…" : c.definition, kind: "d" as const },
    ])
  );
}

export default function Match({ set }: { set: CardSet }) {
  const [tiles, setTiles] = useState<Tile[]>(() => makeTiles(set));
  const [started, setStarted] = useState(false);
  const [start, setStart] = useState(0);
  const [now, setNow] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [bad, setBad] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]); // cardIds animating out
  const [gone, setGone] = useState<string[]>([]);
  const [result, setResult] = useState<{ time: number; xp: number; best: boolean } | null>(null);
  const missed = useRef(new Set<string>());

  const pairs = tiles.length / 2;

  useEffect(() => {
    if (!started || result) return;
    const t = setInterval(() => setNow(performance.now()), 50);
    return () => clearInterval(t);
  }, [started, result]);

  useEffect(() => {
    if (started && gone.length === pairs && !result) {
      const time = performance.now() - start + penalty;
      const secs = time / 1000;
      const xp = Math.max(30, Math.round(150 - secs * 2.5));
      addXp(xp, "Match");
      const best = recordBest(set.id, "match", Math.round(time));
      if (pairs >= 6 && secs < 25) unlock("speed_match");
      finishSession();
      tiles.forEach((t) => t.kind === "t" && recordAnswer(set.id, t.cardId, !missed.current.has(t.cardId)));
      setResult({ time, xp, best });
    }
  }, [gone, pairs, started, result, start, penalty, set.id, tiles]);

  const begin = () => {
    setStarted(true);
    setStart(performance.now());
    setNow(performance.now());
  };

  const click = (t: Tile) => {
    if (gone.includes(t.cardId) || matched.includes(t.cardId)) return;
    if (!sel) return setSel(t.key);
    if (sel === t.key) return setSel(null);
    const other = tiles.find((x) => x.key === sel)!;
    if (other.cardId === t.cardId && other.kind !== t.kind) {
      setMatched((m) => [...m, t.cardId]);
      setSel(null);
      setTimeout(() => setGone((g) => [...g, t.cardId]), 350);
    } else {
      missed.current.add(other.cardId);
      missed.current.add(t.cardId);
      setBad([other.key, t.key]);
      setSel(null);
      setPenalty((p) => p + PENALTY);
      setTimeout(() => setBad([]), 400);
    }
  };

  const restart = () => {
    setTiles(makeTiles(set));
    setStarted(false);
    setPenalty(0);
    setSel(null);
    setMatched([]);
    setGone([]);
    setResult(null);
    missed.current = new Set();
  };

  if (result) {
    return (
      <Results
        set={set}
        emoji={result.best ? "🏅" : "🧩"}
        title={result.best ? "New personal best!" : "All matched!"}
        score={formatTime(result.time)}
        stats={[
          ["Pairs", pairs],
          ["Penalty", `+${penalty / 1000}s`],
          ["Best", set.best.match !== undefined ? formatTime(Math.min(set.best.match, result.time)) : formatTime(result.time)],
        ]}
        xp={result.xp}
        celebrate={result.best}
        onAgain={restart}
      />
    );
  }

  const elapsed = started ? now - start + penalty : 0;

  return (
    <div>
      <StudyTop set={set} progress={gone.length / pairs} right={<span className="timer">{formatTime(elapsed)}</span>} />
      {!started ? (
        <div className="q-card center fade-in">
          <div style={{ fontSize: 56 }}>🧩</div>
          <h2 className="mt-8">Ready to match?</h2>
          <p className="muted mt-8">Pair every term with its definition as fast as you can. Wrong pairs add a 1-second penalty.</p>
          {set.best.match !== undefined && <p className="mt-8 chip">Your best: {formatTime(set.best.match)}</p>}
          <div className="mt-24">
            <button className="btn btn-primary btn-lg" onClick={begin} autoFocus>
              Start game
            </button>
          </div>
        </div>
      ) : (
        <div className="match-grid fade-in">
          {tiles.map((t) => {
            const cls = gone.includes(t.cardId) ? "gone" : matched.includes(t.cardId) ? "ok" : bad.includes(t.key) ? "no" : sel === t.key ? "sel" : "";
            return (
              <button key={t.key} className={`match-tile ${cls}`} onClick={() => click(t)} style={t.kind === "t" ? { fontWeight: 700 } : { fontSize: 13 }}>
                {t.text}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
