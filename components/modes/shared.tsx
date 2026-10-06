"use client";

import { useEffect, useRef, useState } from "react";

export function useCombo() {
  const [combo, setCombo] = useState(0);
  const [pop, setPop] = useState(0);
  return {
    combo,
    hit: () => {
      setCombo((c) => c + 1);
      setPop((p) => p + 1);
    },
    miss: () => setCombo(0),
    view: (
      <span key={pop} className={`combo ${pop ? "pop" : ""}`} title="Combo">
        {combo > 1 ? `🔥 ${combo}×` : ""}
      </span>
    ),
  };
}

/** Multiple choice question. Calls onAnswer once, then onNext when user continues. */
export function ChoiceQuestion({
  label,
  prompt,
  choices,
  correct,
  onAnswer,
  onNext,
  autoAdvanceMs = 900,
  hideFeedback,
}: {
  label: string;
  prompt: string;
  choices: string[];
  correct: string;
  onAnswer: (ok: boolean) => void;
  onNext: () => void;
  autoAdvanceMs?: number;
  hideFeedback?: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const done = picked !== null;
  const ok = picked === correct;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pick = (c: string) => {
    if (done) return;
    setPicked(c);
    const good = c === correct;
    onAnswer(good);
    if (good && autoAdvanceMs >= 0) timer.current = setTimeout(onNext, autoAdvanceMs);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!done && n >= 1 && n <= choices.length) pick(choices[n - 1]);
      else if (done && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="q-card fade-in">
      <div className="q-label">{label}</div>
      <div className="q-prompt">{prompt}</div>
      <div className="choices">
        {choices.map((c, i) => {
          const cls = done ? (c === correct ? "correct" : c === picked ? "wrong" : "") : "";
          return (
            <button key={c + i} className={`choice ${cls}`} disabled={done} onClick={() => pick(c)} style={done && cls === "" ? { opacity: 0.5 } : {}}>
              <span className="k">{i + 1}</span>
              <span>{c}</span>
            </button>
          );
        })}
      </div>
      {done && !hideFeedback && (
        <div className={`feedback ${ok ? "good" : "bad"}`}>
          <b>{ok ? pickPraise() : "Not quite — the correct answer is highlighted."}</b>
          {!ok && (
            <button className="btn btn-sm" onClick={onNext} autoFocus>
              Continue <kbd>Enter</kbd>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const PRAISE = ["Nailed it!", "Correct!", "Great job!", "You got it!", "Brilliant!", "Spot on!", "Nice!"];
export const pickPraise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];
