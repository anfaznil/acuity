"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addXp, finishSession, recordAnswer, recordBest, unlock, type CardSet } from "@/lib/store";
import { answerOf, choicesFor, promptOf, type Direction } from "@/lib/quiz";
import { Results, StudyTop } from "../Study";
import { Ring } from "../TopBar";
import { ChoiceQuestion } from "./shared";

const DURATION = 60_000;

const multFor = (combo: number) => (combo >= 15 ? 4 : combo >= 10 ? 3 : combo >= 5 ? 2 : 1);

export default function Blitz({ set }: { set: CardSet }) {
  const [phase, setPhase] = useState<"ready" | "play" | "done">("ready");
  const [end, setEnd] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [qKey, setQKey] = useState(0);
  const [combo, setCombo] = useState(0);
  const [stats, setStats] = useState({ right: 0, wrong: 0, best: 0 });
  const [xp, setXp] = useState(0);
  const [isBest, setIsBest] = useState(false);
  const lastId = useRef<string | null>(null);

  const q = useMemo(() => {
    let pool = set.cards.filter((c) => c.id !== lastId.current);
    if (!pool.length) pool = set.cards;
    const card = pool[Math.floor(Math.random() * pool.length)];
    lastId.current = card.id;
    const dir: Direction = Math.random() < 0.65 ? "term" : "definition";
    return { card, dir, prompt: promptOf(card, dir), correct: answerOf(card, dir), choices: choicesFor(card, set.cards, dir) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qKey]);

  useEffect(() => {
    if (phase !== "play") return;
    const t = setInterval(() => {
      const l = Math.max(0, end - performance.now());
      setLeft(l);
      if (l <= 0) setPhase("done");
    }, 100);
    return () => clearInterval(t);
  }, [phase, end]);

  useEffect(() => {
    if (phase === "done") {
      const bonus = stats.right >= 10 ? 25 : 0;
      if (bonus) {
        addXp(bonus, "Blitz bonus");
        setXp((x) => x + bonus);
      }
      setIsBest(recordBest(set.id, "blitz", stats.right) && stats.right > 0);
      if (stats.right >= 20) unlock("blitz_20");
      finishSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const start = () => {
    setPhase("play");
    setEnd(performance.now() + DURATION);
    setLeft(DURATION);
    setCombo(0);
    setStats({ right: 0, wrong: 0, best: 0 });
    setXp(0);
    setQKey((k) => k + 1);
  };

  const onAnswer = (ok: boolean) => {
    recordAnswer(set.id, q.card.id, ok);
    if (ok) {
      const c = combo + 1;
      const gain = 5 * multFor(c);
      setCombo(c);
      addXp(gain);
      setXp((x) => x + gain);
      if (c >= 10) unlock("combo_10");
      setStats((s) => ({ ...s, right: s.right + 1, best: Math.max(s.best, c) }));
    } else {
      setCombo(0);
      setStats((s) => ({ ...s, wrong: s.wrong + 1 }));
      // Wrong answers cost 2 seconds
      setEnd((e) => e - 2000);
      const k = qKey;
      setTimeout(() => setQKey((cur) => (cur === k ? cur + 1 : cur)), 900);
    }
  };

  if (phase === "done") {
    return (
      <Results
        set={set}
        emoji={isBest ? "🏅" : "⚡"}
        title={isBest ? "New Blitz record!" : "Time's up!"}
        score={`${stats.right}`}
        stats={[
          ["Correct", stats.right],
          ["Missed", stats.wrong],
          ["Best combo", `${stats.best}×`],
        ]}
        xp={xp}
        celebrate={isBest}
        onAgain={start}
      />
    );
  }

  if (phase === "ready") {
    return (
      <div>
        <StudyTop set={set} progress={0} />
        <div className="q-card center fade-in">
          <div style={{ fontSize: 56 }}>⚡</div>
          <h2 className="mt-8">60-second Blitz</h2>
          <p className="muted mt-8" style={{ maxWidth: 440, margin: "8px auto 0" }}>
            Answer as many as you can. Build a streak to multiply your XP — <b>2×</b> at 5, <b>3×</b> at 10, <b>4×</b> at 15. Wrong answers cost 2 seconds.
          </p>
          {set.best.blitz !== undefined && <p className="mt-16 chip">Your record: {set.best.blitz} correct</p>}
          <div className="mt-24">
            <button className="btn btn-primary btn-lg" onClick={start} autoFocus>
              Go!
            </button>
          </div>
        </div>
      </div>
    );
  }

  const mult = multFor(combo);
  return (
    <div>
      <StudyTop
        set={set}
        progress={left / DURATION}
        right={
          <span className="row" style={{ gap: 8 }}>
            {mult > 1 && <span className="mult">{mult}× XP</span>}
            <span className="combo">{combo > 1 ? `🔥 ${combo}` : ""}</span>
          </span>
        }
      />
      <div className="row" style={{ justifyContent: "center", marginBottom: 18, gap: 24 }}>
        <Ring pct={left / DURATION} size={84} stroke={8} color={left < 10_000 ? "var(--bad)" : "var(--warn)"}>
          <span style={{ fontSize: 22, fontFamily: "var(--font-display)" }}>{Math.ceil(left / 1000)}</span>
        </Ring>
        <div>
          <div className="stat-val">{stats.right}</div>
          <div className="stat-lbl">Correct</div>
        </div>
      </div>
      <ChoiceQuestion
        key={qKey}
        label={q.dir === "term" ? "Definition?" : "Term?"}
        prompt={q.prompt}
        choices={q.choices}
        correct={q.correct}
        onAnswer={onAnswer}
        onNext={() => setQKey((k) => k + 1)}
        autoAdvanceMs={350}
        hideFeedback
      />
    </div>
  );
}
