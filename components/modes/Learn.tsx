"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addXp, finishSession, recordAnswer, unlock, type CardSet } from "@/lib/store";
import { answerOf, choicesFor, promptOf, shuffle, type Direction } from "@/lib/quiz";
import { Results, StudyTop } from "../Study";
import { ChoiceQuestion, useCombo } from "./shared";

const NEED = 2; // correct answers needed per card in a session

type Item = { id: string; dir: Direction };

function makeQueue(set: CardSet): Item[] {
  // Prioritize weakest cards, cap session at 20 cards
  return shuffle(shuffle(set.cards).sort((a, b) => a.mastery - b.mastery).slice(0, 20)).map((c) => ({ id: c.id, dir: "term" as Direction }));
}

export default function Learn({ set }: { set: CardSet }) {
  const [queue, setQueue] = useState<Item[]>(() => makeQueue(set));
  const [total, setTotal] = useState(() => Math.min(20, set.cards.length) * NEED);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const progressRef = useRef<Record<string, number>>({});
  const lastOk = useRef(false);
  const [qKey, setQKey] = useState(0);
  const [stats, setStats] = useState({ right: 0, wrong: 0, best: 0 });
  const [xp, setXp] = useState(0);
  const combo = useCombo();

  const doneCount = Object.values(progress).reduce((a, b) => a + Math.min(b, NEED), 0);
  const current = queue[0];
  const card = current && set.cards.find((c) => c.id === current.id);

  const question = useMemo(() => {
    if (!card) return null;
    return { prompt: promptOf(card, current.dir), correct: answerOf(card, current.dir), choices: choicesFor(card, set.cards, current.dir) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qKey, card?.id]);

  const restart = () => {
    const q = makeQueue(set);
    setQueue(q);
    setTotal(q.length * NEED);
    progressRef.current = {};
    setProgress({});
    setStats({ right: 0, wrong: 0, best: 0 });
    setXp(0);
    combo.miss();
    setQKey((k) => k + 1);
  };

  const onAnswer = (ok: boolean) => {
    if (!card) return;
    recordAnswer(set.id, card.id, ok);
    lastOk.current = ok;
    if (ok) {
      combo.hit();
      const c = combo.combo + 1;
      const gain = 10 + Math.min(c - 1, 10);
      addXp(gain);
      setXp((x) => x + gain);
      if (c >= 10) unlock("combo_10");
      setStats((s) => ({ ...s, right: s.right + 1, best: Math.max(s.best, c) }));
      progressRef.current = { ...progressRef.current, [card.id]: (progressRef.current[card.id] ?? 0) + 1 };
      setProgress(progressRef.current);
    } else {
      combo.miss();
      setStats((s) => ({ ...s, wrong: s.wrong + 1 }));
    }
  };

  const onNext = () => {
    const ok = lastOk.current;
    setQueue((q) => {
      const [head, ...rest] = q;
      if (!head) return q;
      const got = progressRef.current[head.id] ?? 0;
      if (ok && got >= NEED) return rest;
      // Re-insert: if correct, ask reversed later; if wrong, ask again soon
      const next: Item = { id: head.id, dir: ok ? (head.dir === "term" ? "definition" : "term") : head.dir };
      const pos = ok ? Math.min(rest.length, 4 + Math.floor(Math.random() * 3)) : Math.min(rest.length, 2 + Math.floor(Math.random() * 2));
      return [...rest.slice(0, pos), next, ...rest.slice(pos)];
    });
    setQKey((k) => k + 1);
  };

  const finished = !card || !question;
  const awarded = useRef(false);
  useEffect(() => {
    if (finished && !awarded.current) {
      awarded.current = true;
      addXp(30, "Session bonus");
      setXp((x) => x + 30);
      finishSession();
    }
    if (!finished) awarded.current = false;
  }, [finished]);

  if (!card || !question) {
    const acc = Math.round((stats.right / Math.max(1, stats.right + stats.wrong)) * 100);
    return (
      <Results
        set={set}
        emoji="🎯"
        title="Learning round complete!"
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

  return (
    <div>
      <StudyTop set={set} progress={doneCount / total} right={combo.view} />
      <ChoiceQuestion
        key={qKey}
        label={current.dir === "term" ? "Choose the matching definition" : "Choose the matching term"}
        prompt={question.prompt}
        choices={question.choices}
        correct={question.correct}
        onAnswer={onAnswer}
        onNext={onNext}
      />
      <p className="center faint mt-16" style={{ fontSize: 13 }}>
        Press <kbd>1</kbd>–<kbd>4</kbd> to answer · each card needs {NEED} correct answers
      </p>
    </div>
  );
}
