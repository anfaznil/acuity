"use client";

import { deleteSet, exportData, masteryStats, resetProgress, toggleStar, useStore } from "@/lib/store";
import { formatTime } from "@/lib/quiz";
import { go } from "./App";
import { GRADS, timeAgo } from "./Home";
import { useState } from "react";

export const MODES = [
  { key: "flashcards", name: "Flashcards", icon: "🃏", desc: "Flip, review and sort what you know", xp: "+2 XP / card", grad: "var(--g0)", min: 1 },
  { key: "learn", name: "Learn", icon: "🎯", desc: "Adaptive multiple choice until mastered", xp: "+10 XP / answer", grad: "var(--g2)", min: 2 },
  { key: "write", name: "Write", icon: "⌨️", desc: "Type answers from memory", xp: "+15 XP / answer", grad: "var(--g3)", min: 1 },
  { key: "match", name: "Match", icon: "🧩", desc: "Pair terms and definitions against the clock", xp: "Up to 150 XP", grad: "var(--g1)", min: 2 },
  { key: "blitz", name: "Blitz", icon: "⚡", desc: "60-second sprint with combo multipliers", xp: "Combo ×4 XP", grad: "var(--g4)", min: 2 },
  { key: "test", name: "Test", icon: "📝", desc: "Mixed exam: MC, true/false and written", xp: "Up to 200 XP", grad: "var(--g5)", min: 2 },
] as const;

function downloadJson(name: string, json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function SetView({ id }: { id: string }) {
  const s = useStore((st) => st.sets.find((x) => x.id === id));
  const [filter, setFilter] = useState<"all" | "starred" | "learning">("all");
  if (!s) {
    return (
      <div className="empty mt-32">
        <h3>Set not found</h3>
        <button className="btn mt-16" onClick={() => go("/")}>
          Back to library
        </button>
      </div>
    );
  }
  const m = masteryStats(s.cards);
  const cards = s.cards.filter((c) => (filter === "starred" ? c.starred : filter === "learning" ? c.mastery < 4 : true));

  return (
    <div className="fade-in">
      <button className="btn btn-ghost btn-sm" onClick={() => go("/")} style={{ marginTop: 20, marginLeft: -12 }}>
        ← Library
      </button>
      <div className="set-hero" style={{ paddingTop: 12 }}>
        <div className="set-emoji" style={{ background: GRADS[s.color % GRADS.length] }}>
          {s.emoji}
        </div>
        <div className="grow" style={{ minWidth: 240 }}>
          <h1>{s.title}</h1>
          <p className="muted mt-8">{s.description}</p>
          <div className="row wrap mt-8" style={{ gap: 8 }}>
            <span className="chip plain">{s.cards.length} cards</span>
            {s.source && <span className="chip plain">📄 {s.source.length > 40 ? s.source.slice(0, 40) + "…" : s.source}</span>}
            {s.lastStudied && <span className="chip plain">Studied {timeAgo(s.lastStudied)}</span>}
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => go(`/set/${s.id}/edit`)}>
            ✏️ Edit
          </button>
          <button className="btn" onClick={() => downloadJson(`${s.title.replace(/[^\w]+/g, "-")}.json`, JSON.stringify(s, null, 2))} title="Export this set">
            ⬇ Export
          </button>
        </div>
      </div>

      <div className="card pad mt-16">
        <div className="spread wrap">
          <div className="row wrap" style={{ gap: 18 }}>
            <span>
              <b style={{ color: "var(--good)" }}>{m.mastered}</b> <span className="muted">mastered</span>
            </span>
            <span>
              <b style={{ color: "var(--warn)" }}>{m.learning}</b> <span className="muted">learning</span>
            </span>
            <span>
              <b>{m.fresh}</b> <span className="muted">new</span>
            </span>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            {s.best.match !== undefined && <span className="chip">🧩 Best match {formatTime(s.best.match)}</span>}
            {s.best.blitz !== undefined && <span className="chip">⚡ Best blitz {s.best.blitz}</span>}
            {s.best.test !== undefined && <span className="chip">📝 Best test {s.best.test}%</span>}
          </div>
        </div>
        <div className="progress mt-16" style={{ height: 10 }}>
          <div className="m" style={{ width: `${(m.mastered / Math.max(1, s.cards.length)) * 100}%` }} />
          <div className="l" style={{ width: `${(m.learning / Math.max(1, s.cards.length)) * 100}%` }} />
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 32 }}>
        <h2>Choose a challenge</h2>
      </div>
      <div className="mode-grid">
        {MODES.map((mode) => {
          const disabled = s.cards.length < mode.min;
          return (
            <button key={mode.key} className="mode-tile" disabled={disabled} style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : {}} onClick={() => go(`/set/${s.id}/${mode.key}`)}>
              <div className="mode-icon" style={{ background: mode.grad }}>
                {mode.icon}
              </div>
              <h3>{mode.name}</h3>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.35 }}>
                {mode.desc}
              </div>
              <div className="xp-hint mt-8">{disabled ? `Needs ${mode.min}+ cards` : mode.xp}</div>
            </button>
          );
        })}
      </div>

      <div className="section-head">
        <h2>Cards in this set</h2>
        <div className="tabs">
          {(["all", "learning", "starred"] as const).map((f) => (
            <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "learning" ? "Still learning" : "★ Starred"}
            </button>
          ))}
        </div>
      </div>
      <div className="term-list">
        {cards.map((c) => (
          <div key={c.id} className="card term-row">
            <div className="t">{c.term}</div>
            <div className="d muted">{c.definition}</div>
            <div className="col" style={{ alignItems: "flex-end", gap: 6 }}>
              <button className="icon-btn" style={{ color: c.starred ? "var(--gold)" : undefined }} onClick={() => toggleStar(s.id, c.id)} title="Star">
                {c.starred ? "★" : "☆"}
              </button>
              <div className="dots" title={`Mastery ${c.mastery}/5`}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className={i < c.mastery ? "on" : ""} />
                ))}
              </div>
            </div>
          </div>
        ))}
        {cards.length === 0 && <div className="empty muted">No cards match this filter.</div>}
      </div>

      <div className="row wrap mt-32" style={{ justifyContent: "flex-end" }}>
        <button
          className="btn btn-sm"
          onClick={() => {
            if (confirm("Reset mastery progress for this set?")) resetProgress(s.id);
          }}
        >
          Reset progress
        </button>
        <button
          className="btn btn-sm btn-danger"
          onClick={() => {
            if (confirm(`Delete "${s.title}"? This can't be undone.`)) {
              deleteSet(s.id);
              go("/");
            }
          }}
        >
          Delete set
        </button>
      </div>
    </div>
  );
}

export { downloadJson, exportData };
