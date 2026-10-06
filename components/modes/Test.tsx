"use client";

import { useState } from "react";
import { addXp, finishSession, recordAnswer, recordBest, unlock, type CardSet } from "@/lib/store";
import { answerOf, choicesFor, grade, promptOf, shuffle, type Direction } from "@/lib/quiz";
import { Results, StudyTop } from "../Study";

type Q =
  | { kind: "mc"; cardId: string; prompt: string; correct: string; choices: string[]; dir: Direction }
  | { kind: "tf"; cardId: string; prompt: string; shown: string; truth: boolean; correct: string; dir: Direction }
  | { kind: "written"; cardId: string; prompt: string; correct: string; dir: Direction };

type Config = { count: number; mc: boolean; tf: boolean; written: boolean };

function buildTest(set: CardSet, cfg: Config): Q[] {
  const kinds = (["mc", "tf", "written"] as const).filter((k) => cfg[k]);
  const cards = shuffle(set.cards).slice(0, cfg.count);
  return cards.map((c, i) => {
    const kind = kinds[i % kinds.length];
    const dir: Direction = Math.random() < 0.6 ? "definition" : "term";
    const prompt = promptOf(c, dir);
    const correct = answerOf(c, dir);
    if (kind === "mc") return { kind, cardId: c.id, prompt, correct, choices: choicesFor(c, set.cards, dir), dir };
    if (kind === "tf") {
      const others = set.cards.filter((x) => x.id !== c.id);
      const truth = others.length === 0 || Math.random() < 0.5;
      const shown = truth ? correct : answerOf(others[Math.floor(Math.random() * others.length)], dir);
      return { kind, cardId: c.id, prompt, shown, truth, correct, dir };
    }
    return { kind, cardId: c.id, prompt, correct, dir };
  });
}

export default function Test({ set }: { set: CardSet }) {
  const [cfg, setCfg] = useState<Config>({ count: Math.min(20, set.cards.length), mc: true, tf: true, written: true });
  const [qs, setQs] = useState<Q[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [graded, setGraded] = useState<null | { results: boolean[]; pct: number; xp: number; best: boolean }>(null);
  const [showReview, setShowReview] = useState(false);

  const submit = () => {
    if (!qs) return;
    const results = qs.map((q, i) => {
      const a = answers[i] ?? "";
      if (q.kind === "mc") return a === q.correct;
      if (q.kind === "tf") return a === String(q.truth);
      return grade(a, q.correct) === "correct";
    });
    results.forEach((ok, i) => recordAnswer(set.id, qs[i].cardId, ok));
    const pct = Math.round((results.filter(Boolean).length / qs.length) * 100);
    const xp = Math.round(pct * 1.5 * Math.min(1, qs.length / 10)) + (pct === 100 ? 50 : 0);
    addXp(xp, "Test");
    const best = recordBest(set.id, "test", pct);
    if (pct === 100 && qs.length >= 5) unlock("perfect_test");
    finishSession();
    setGraded({ results, pct, xp, best });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!qs) {
    const n = set.cards.length;
    return (
      <div>
        <StudyTop set={set} progress={0} />
        <div className="q-card fade-in">
          <div className="center">
            <div style={{ fontSize: 56 }}>📝</div>
            <h2 className="mt-8">Practice test</h2>
            <p className="muted mt-8">Simulate the real thing. Get graded at the end.</p>
          </div>
          <div className="col mt-24" style={{ gap: 18 }}>
            <div>
              <span className="label">Questions: {cfg.count}</span>
              <input type="range" min={Math.min(3, n)} max={n} value={cfg.count} onChange={(e) => setCfg({ ...cfg, count: Number(e.target.value) })} style={{ width: "100%", accentColor: "var(--primary)" }} />
            </div>
            <div>
              <span className="label">Question types</span>
              <div className="seg">
                {(
                  [
                    ["mc", "Multiple choice"],
                    ["tf", "True / False"],
                    ["written", "Written"],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    className={cfg[k] ? "active" : ""}
                    onClick={() => {
                      const next = { ...cfg, [k]: !cfg[k] };
                      if (next.mc || next.tf || next.written) setCfg(next);
                    }}
                  >
                    {cfg[k] ? "✓ " : ""}
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary btn-lg" onClick={() => { setQs(buildTest(set, cfg)); setAnswers({}); setGraded(null); }}>
              Start test
            </button>
          </div>
        </div>
      </div>
    );
  }

  const answered = Object.keys(answers).filter((k) => answers[Number(k)] !== "").length;

  return (
    <div>
      <StudyTop set={set} progress={graded ? 1 : answered / qs.length} right={<span className="muted" style={{ fontWeight: 700 }}>{answered}/{qs.length}</span>} />
      {graded && (
        <Results
          set={set}
          emoji={graded.pct === 100 ? "💯" : graded.pct >= 80 ? "🎉" : graded.pct >= 60 ? "👍" : "📚"}
          title={graded.pct === 100 ? "Perfect score!" : graded.pct >= 80 ? "Great work!" : graded.pct >= 60 ? "Solid effort" : "Keep practicing"}
          score={`${graded.pct}%`}
          stats={[
            ["Correct", graded.results.filter(Boolean).length],
            ["Wrong", graded.results.filter((r) => !r).length],
            ["Best", `${Math.max(set.best.test ?? 0, graded.pct)}%`],
          ]}
          xp={graded.xp}
          celebrate={graded.pct >= 90}
          onAgain={() => { setQs(null); setGraded(null); }}
          extra={
            <div className="mt-16">
              <button className="btn btn-sm" onClick={() => setShowReview((v) => !v)}>
                {showReview ? "Hide" : "Review"} answers
              </button>
            </div>
          }
        />
      )}
      {(!graded || showReview) && (
        <div className="col" style={{ gap: 16, maxWidth: 760, margin: "0 auto" }}>
          {qs.map((q, i) => {
            const res = graded?.results[i];
            const a = answers[i] ?? "";
            const set_ = (v: string) => !graded && setAnswers((x) => ({ ...x, [i]: v }));
            return (
              <div key={i} className="card test-q fade-in" style={graded ? { borderColor: res ? "var(--good)" : "var(--bad)" } : {}}>
                <div className="spread">
                  <div className="q-label">
                    {i + 1}. {q.kind === "mc" ? "Multiple choice" : q.kind === "tf" ? "True or false" : "Written"} · {q.dir === "definition" ? "give the term" : "give the definition"}
                  </div>
                  {graded && <span className={`chip ${res ? "good" : "bad"}`}>{res ? "Correct" : "Incorrect"}</span>}
                </div>
                <div className="q-prompt" style={{ fontSize: 18 }}>
                  {q.prompt}
                </div>
                {q.kind === "mc" && (
                  <div className="choices" style={{ marginTop: 16 }}>
                    {q.choices.map((c, j) => {
                      const cls = graded ? (c === q.correct ? "correct" : c === a ? "wrong" : "") : a === c ? "correct" : "";
                      return (
                        <button key={j} className={`choice ${cls}`} style={!graded && a === c ? { borderColor: "var(--primary)", background: "var(--primary-soft)" } : {}} onClick={() => set_(c)} disabled={!!graded}>
                          <span className="k">{String.fromCharCode(65 + j)}</span>
                          <span>{c}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {q.kind === "tf" && (
                  <>
                    <div className="card pad mt-16" style={{ background: "var(--surface-2)" }}>
                      {q.shown}
                    </div>
                    <div className="tf-row">
                      {(["true", "false"] as const).map((v) => (
                        <button
                          key={v}
                          className={`btn grow ${a === v ? "btn-primary" : ""}`}
                          onClick={() => set_(v)}
                          disabled={!!graded}
                          style={graded && String(q.truth) === v ? { borderColor: "var(--good)", background: "var(--good-soft)", color: "var(--good)" } : {}}
                        >
                          {v === "true" ? "True" : "False"}
                        </button>
                      ))}
                    </div>
                    {graded && !q.truth && <p className="muted mt-8" style={{ fontSize: 13 }}>Correct answer: {q.correct}</p>}
                  </>
                )}
                {q.kind === "written" && (
                  <>
                    <input className="input mt-16" placeholder="Type your answer…" value={a} onChange={(e) => set_(e.target.value)} readOnly={!!graded} />
                    {graded && !res && <p className="muted mt-8" style={{ fontSize: 13 }}>Correct answer: {q.correct}</p>}
                  </>
                )}
              </div>
            );
          })}
          {!graded && (
            <div className="row" style={{ justifyContent: "flex-end", position: "sticky", bottom: 16 }}>
              <button className="btn btn-primary btn-lg" onClick={submit}>
                Submit test ({answered}/{qs.length} answered)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
