"use client";

import { useStore, type CardSet } from "@/lib/store";
import { go } from "./App";
import { MODES } from "./SetView";
import Flashcards from "./modes/Flashcards";
import Learn from "./modes/Learn";
import Write from "./modes/Write";
import Match from "./modes/Match";
import Blitz from "./modes/Blitz";
import Test from "./modes/Test";
import { fireConfetti } from "./FxLayer";
import { useEffect } from "react";

export function StudyTop({ set, progress, right }: { set: CardSet; progress: number; right?: React.ReactNode }) {
  return (
    <div className="study-top">
      <button className="icon-btn" onClick={() => go(`/set/${set.id}`)} aria-label="Exit" title="Exit (Esc)">
        ✕
      </button>
      <div className="study-progress">
        <div style={{ width: `${Math.min(1, progress) * 100}%` }} />
      </div>
      {right}
    </div>
  );
}

export function Results({
  set,
  emoji,
  title,
  score,
  stats,
  xp,
  onAgain,
  extra,
  celebrate,
}: {
  set: CardSet;
  emoji: string;
  title: string;
  score: string;
  stats: [string, string | number][];
  xp: number;
  onAgain: () => void;
  extra?: React.ReactNode;
  celebrate?: boolean;
}) {
  useEffect(() => {
    if (celebrate) fireConfetti();
  }, [celebrate]);
  return (
    <div className="card results fade-in">
      <div style={{ fontSize: 56 }}>{emoji}</div>
      <h2 className="mt-8">{title}</h2>
      <div className="big-score mt-16">{score}</div>
      <div className="result-stats">
        {stats.map(([k, v]) => (
          <div key={k} className="stat">
            <div className="stat-val" style={{ fontSize: 22 }}>
              {v}
            </div>
            <div className="stat-lbl">{k}</div>
          </div>
        ))}
      </div>
      <div className="chip" style={{ fontSize: 15, padding: "8px 16px" }}>
        ✨ +{xp} XP earned
      </div>
      {extra}
      <div className="row wrap mt-24" style={{ justifyContent: "center" }}>
        <button className="btn btn-primary btn-lg" onClick={onAgain}>
          Play again
        </button>
        <button className="btn btn-lg" onClick={() => go(`/set/${set.id}`)}>
          Back to set
        </button>
      </div>
      <div className="row wrap mt-16" style={{ justifyContent: "center", gap: 6 }}>
        {MODES.filter((m) => set.cards.length >= m.min).map((m) => (
          <button key={m.key} className="btn btn-sm btn-ghost" onClick={() => go(`/set/${set.id}/${m.key}`)}>
            {m.icon} {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Study({ id, mode }: { id: string; mode: string }) {
  const set = useStore((s) => s.sets.find((x) => x.id === id));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") go(`/set/${id}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id]);

  if (!set) return <div className="empty mt-32">Set not found.</div>;
  switch (mode) {
    case "flashcards":
      return <Flashcards set={set} />;
    case "learn":
      return <Learn set={set} />;
    case "write":
      return <Write set={set} />;
    case "match":
      return <Match set={set} />;
    case "blitz":
      return <Blitz set={set} />;
    case "test":
      return <Test set={set} />;
    default:
      return <div className="empty mt-32">Unknown mode.</div>;
  }
}
