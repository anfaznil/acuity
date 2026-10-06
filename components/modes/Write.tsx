"use client";

import { useEffect, useRef, useState } from "react";
import { addXp, finishSession, recordAnswer, unlock, type CardSet } from "@/lib/store";
import { answerOf, grade, promptOf, shuffle, type Direction } from "@/lib/quiz";
import { Results, StudyTop } from "../Study";
import { pickPraise, useCombo } from "./shared";

export default function Write({ set }: { set: CardSet }) {
  const [dir, setDir] = useState<Direction>("definition"); // show definition, type term
  const [queue, setQueue] = useState(() => shuffle(set.cards).map((c) => c.id));
  const [total, setTotal] = useState(set.cards.length);
  const [retried, setRetried] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [result, setResult] = useState<null | "correct" | "close" | "wrong">(null);
  const [stats, setStats] = useState({ right: 0, wrong: 0, best: 0 });
  const [xp, setXp] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const combo = useCombo();
  const inputRef = useRef<HTMLInputElement>(null);
  const awarded = useRef(false);

  const card = set.cards.find((c) => c.id === queue[0]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [queue, result]);

  useEffect(() => {
    if (!card && !awarded.current) {
      awarded.current = true;
      addXp(30, "Session bonus");
      setXp((x) => x + 30);
      finishSession();
    }
  }, [card]);

  const award = (ok: boolean) => {
    if (!card) return;
    recordAnswer(set.id, card.id, ok);
    if (ok) {
      combo.hit();
      const c = combo.combo + 1;
      const gain = 15 + Math.min(c - 1, 10);
      addXp(gain);
      setXp((x) => x + gain);
      if (c >= 10) unlock("combo_10");
      setStats((s) => ({ ...s, right: s.right + 1, best: Math.max(s.best, c) }));
    } else {
      combo.miss();
      setStats((s) => ({ ...s, wrong: s.wrong + 1 }));
    }
  };

  const submit = () => {
    if (!card || result) return;
    const r = grade(input, answerOf(card, dir));
    setResult(r);
    if (r === "correct") award(true);
    else if (r === "wrong") award(false);
  };

  const next = (finalOk?: boolean) => {
    if (!card) return;
    const ok = finalOk ?? result === "correct";
    setQueue((q) => {
      const rest = q.slice(1);
      if (!ok && !retried.has(card.id)) {
        setRetried((r) => new Set(r).add(card.id));
        setTotal((t) => t + 1);
        return [...rest, card.id];
      }
      return rest;
    });
    setDoneCount((d) => d + 1);
    setInput("");
    setResult(null);
  };

  const override = () => {
    // Undo the wrong record and count it as right
    if (result === "wrong") setStats((s) => ({ ...s, wrong: Math.max(0, s.wrong - 1) }));
    award(true);
    next(true);
  };

  const restart = () => {
    setQueue(shuffle(set.cards).map((c) => c.id));
    setTotal(set.cards.length);
    setRetried(new Set());
    setStats({ right: 0, wrong: 0, best: 0 });
    setXp(0);
    setDoneCount(0);
    combo.miss();
    awarded.current = false;
  };

  if (!card) {
    const acc = Math.round((stats.right / Math.max(1, stats.right + stats.wrong)) * 100);
    return (
      <Results
        set={set}
        emoji="⌨️"
        title="Writing round complete!"
        score={`${acc}%`}
        stats={[
          ["Correct", stats.right],
          ["Missed", stats.wrong],
          ["Best combo", `${stats.best}×`],
        ]}
        xp={xp}
        celebrate={acc >= 90}
        onAgain={restart}
      />
    );
  }

  const answer = answerOf(card, dir);

  return (
    <div>
      <StudyTop set={set} progress={doneCount / total} right={combo.view} />
      <div className="row" style={{ justifyContent: "center", marginBottom: 16 }}>
        <div className="tabs">
          <button className={dir === "definition" ? "active" : ""} onClick={() => { setDir("definition"); setResult(null); setInput(""); }}>
            Answer with term
          </button>
          <button className={dir === "term" ? "active" : ""} onClick={() => { setDir("term"); setResult(null); setInput(""); }}>
            Answer with definition
          </button>
        </div>
      </div>
      <div className="q-card fade-in" key={card.id + doneCount}>
        <div className="q-label">{dir === "definition" ? "Definition" : "Term"}</div>
        <div className="q-prompt">{promptOf(card, dir)}</div>
        <form
          className="mt-24"
          onSubmit={(e) => {
            e.preventDefault();
            if (result) next();
            else submit();
          }}
        >
          <span className="label">Your answer</span>
          <div className="row">
            <input
              ref={inputRef}
              className="input"
              style={{ fontSize: 17 }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              readOnly={!!result}
              placeholder={`Type the ${dir === "definition" ? "term" : "definition"}…`}
              autoComplete="off"
              spellCheck={false}
            />
            {!result && (
              <>
                <button type="button" className="btn" onClick={() => { setResult("wrong"); award(false); }}>
                  Don&apos;t know
                </button>
                <button className="btn btn-primary" type="submit">
                  Check
                </button>
              </>
            )}
          </div>
          {result === "correct" && (
            <div className="feedback good">
              <b>{pickPraise()}</b>
              <span className="ans">{answer}</span>
              <button className="btn btn-sm" type="submit">
                Next <kbd>Enter</kbd>
              </button>
            </div>
          )}
          {result === "close" && (
            <div className="feedback close">
              <div>
                <b>Almost!</b> The answer is: <span className="ans">{answer}</span>
              </div>
              <div className="row">
                <button type="button" className="btn btn-sm" onClick={() => { award(false); next(false); }}>
                  Mark wrong
                </button>
                <button type="button" className="btn btn-sm btn-know" onClick={override}>
                  I was right
                </button>
              </div>
            </div>
          )}
          {result === "wrong" && (
            <div className="feedback bad">
              <div>
                <b>Correct answer:</b> <span className="ans">{answer}</span>
              </div>
              <div className="row">
                {input.trim() && (
                  <button type="button" className="btn btn-sm" onClick={override}>
                    I was right
                  </button>
                )}
                <button className="btn btn-sm" type="submit">
                  Continue <kbd>Enter</kbd>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
      <p className="center faint mt-16" style={{ fontSize: 13 }}>
        Small typos are forgiven · missed cards come back once at the end
      </p>
    </div>
  );
}
