"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addXp, finishSession, recordAnswer, toggleStar, useStore, type CardSet } from "@/lib/store";
import { shuffle } from "@/lib/quiz";
import { Results, StudyTop } from "../Study";

export default function Flashcards({ set }: { set: CardSet }) {
  const [seed, setSeed] = useState(0);
  const [onlyIds, setOnlyIds] = useState<string[] | null>(null);
  const [shuffled, setShuffled] = useState(false);
  const [defFirst, setDefFirst] = useState(false);
  const deck = useMemo(() => {
    const base = onlyIds ? set.cards.filter((c) => onlyIds.includes(c.id)) : set.cards;
    return shuffled ? shuffle(base) : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, shuffled, onlyIds]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [anim, setAnim] = useState<"" | "swipe-out-left" | "swipe-out-right">("");
  const [known, setKnown] = useState<string[]>([]);
  const [learning, setLearning] = useState<string[]>([]);
  const [xp, setXp] = useState(0);
  const card = deck[i];
  const live = useStore((s) => s.sets.find((x) => x.id === set.id)?.cards.find((c) => c.id === card?.id));

  const restart = (ids: string[] | null) => {
    setOnlyIds(ids);
    setSeed((x) => x + 1);
    setI(0);
    setFlipped(false);
    setKnown([]);
    setLearning([]);
    setXp(0);
  };

  const answer = useCallback(
    (know: boolean) => {
      if (!card || anim) return;
      setAnim(know ? "swipe-out-right" : "swipe-out-left");
      recordAnswer(set.id, card.id, know);
      if (know) {
        setKnown((k) => [...k, card.id]);
        addXp(2);
        setXp((x) => x + 2);
      } else setLearning((l) => [...l, card.id]);
      setTimeout(() => {
        setAnim("");
        setFlipped(false);
        setI((x) => x + 1);
        if (i + 1 >= deck.length) {
          addXp(15, "Session bonus");
          setXp((x) => x + 15);
          finishSession();
        }
      }, 300);
    },
    [card, anim, set.id, i, deck.length]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight" || e.key === "2") answer(true);
      else if (e.key === "ArrowLeft" || e.key === "1") answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer]);

  if (i >= deck.length) {
    return (
      <Results
        set={set}
        emoji={learning.length === 0 ? "🏆" : "🃏"}
        title={learning.length === 0 ? "You knew them all!" : "Deck complete"}
        score={`${known.length}/${deck.length}`}
        stats={[
          ["Know", known.length],
          ["Learning", learning.length],
          ["Accuracy", `${Math.round((known.length / Math.max(1, deck.length)) * 100)}%`],
        ]}
        xp={xp}
        celebrate={learning.length === 0}
        onAgain={() => restart(null)}
        extra={
          learning.length > 0 && (
            <div className="mt-16">
              <button className="btn" onClick={() => restart(learning)}>
                🔁 Review {learning.length} still-learning card{learning.length === 1 ? "" : "s"}
              </button>
            </div>
          )
        }
      />
    );
  }

  const front = defFirst ? card.definition : card.term;
  const back = defFirst ? card.term : card.definition;

  return (
    <div className="fade-in">
      <StudyTop set={set} progress={i / deck.length} right={<span className="muted" style={{ fontWeight: 700, minWidth: 64, textAlign: "right" }}>{i + 1} / {deck.length}</span>} />
      <div className="row wrap" style={{ justifyContent: "center", marginBottom: 18, gap: 8 }}>
        <button className={`btn btn-sm ${shuffled ? "btn-primary" : ""}`} onClick={() => { setShuffled((v) => !v); setI(0); setFlipped(false); }}>
          🔀 Shuffle
        </button>
        <button className={`btn btn-sm ${defFirst ? "btn-primary" : ""}`} onClick={() => setDefFirst((v) => !v)}>
          ⇄ {defFirst ? "Definition first" : "Term first"}
        </button>
        <span className="chip good">✓ {known.length}</span>
        <span className="chip warn">↺ {learning.length}</span>
      </div>
      <div className="flip-scene">
        <div className={anim}>
          <div className={`flip-card ${flipped ? "flipped" : ""}`} onClick={() => setFlipped((f) => !f)}>
            <div className="flip-face">
              <span className="corner">{defFirst ? "Definition" : "Term"}</span>
              <button
                className="icon-btn star"
                style={{ color: live?.starred ? "var(--gold)" : undefined }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStar(set.id, card.id);
                }}
              >
                {live?.starred ? "★" : "☆"}
              </button>
              <div className="content">{front}</div>
            </div>
            <div className="flip-face back">
              <span className="corner">{defFirst ? "Term" : "Definition"}</span>
              <div className="content">{back}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="fc-actions">
        <button className="btn btn-lg btn-learning" onClick={() => answer(false)}>
          ↺ Still learning <kbd>←</kbd>
        </button>
        <button className="btn btn-lg" onClick={() => setFlipped((f) => !f)}>
          Flip <kbd>space</kbd>
        </button>
        <button className="btn btn-lg btn-know" onClick={() => answer(true)}>
          ✓ Know it <kbd>→</kbd>
        </button>
      </div>
    </div>
  );
}
