"use client";

import { useState } from "react";
import { GRADS } from "./Home";

export type Draft = {
  title: string;
  description: string;
  emoji: string;
  color?: number;
  cards: { id?: string; term: string; definition: string }[];
};

const EMOJIS = ["📚", "🧬", "🧪", "🧠", "📐", "🌍", "⚖️", "💻", "🩺", "📈", "🎨", "🏛️", "🔬", "🗣️", "🎵", "⚡"];

export default function SetForm({
  initial,
  onSave,
  onCancel,
  saveLabel = "Save set",
  banner,
}: {
  initial: Draft;
  onSave: (d: Draft) => void;
  onCancel?: () => void;
  saveLabel?: string;
  banner?: React.ReactNode;
}) {
  const [d, setD] = useState<Draft>(() => ({
    ...initial,
    cards: initial.cards.length ? initial.cards : [{ term: "", definition: "" }, { term: "", definition: "" }, { term: "", definition: "" }],
  }));
  const [pickEmoji, setPickEmoji] = useState(false);

  const updateCard = (i: number, patch: Partial<Draft["cards"][number]>) =>
    setD((x) => ({ ...x, cards: x.cards.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const valid = d.cards.filter((c) => c.term.trim() && c.definition.trim());

  return (
    <div className="col fade-in" style={{ gap: 16 }}>
      {banner}
      <div className="card pad-lg">
        <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
          <div style={{ position: "relative" }}>
            <button
              className="set-emoji"
              style={{ background: GRADS[(d.color ?? 0) % GRADS.length], border: 0, cursor: "pointer", width: 60, height: 60, fontSize: 30 }}
              onClick={() => setPickEmoji((v) => !v)}
              title="Change icon"
            >
              {d.emoji}
            </button>
            {pickEmoji && (
              <div className="card pad" style={{ position: "absolute", top: 68, left: 0, zIndex: 10, width: 260, boxShadow: "var(--shadow-lg)" }}>
                <div className="row wrap" style={{ gap: 6 }}>
                  {EMOJIS.map((e) => (
                    <button key={e} className="icon-btn" style={{ fontSize: 20 }} onClick={() => { setD({ ...d, emoji: e }); setPickEmoji(false); }}>
                      {e}
                    </button>
                  ))}
                </div>
                <div className="row mt-8" style={{ gap: 6 }}>
                  {GRADS.map((g, i) => (
                    <button key={i} onClick={() => setD({ ...d, color: i })} style={{ width: 28, height: 28, borderRadius: 8, background: g, border: d.color === i ? "2px solid var(--text)" : "0", cursor: "pointer" }} />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="grow col" style={{ gap: 10 }}>
            <input className="input" style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-display)" }} placeholder="Set title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
            <input className="input" placeholder="Description (optional)" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="spread">
        <h3>
          {valid.length} card{valid.length === 1 ? "" : "s"}
        </h3>
        <button className="btn btn-sm" onClick={() => setD({ ...d, cards: d.cards.map((c) => ({ ...c, term: c.definition, definition: c.term })) })}>
          ⇄ Swap sides
        </button>
      </div>

      <div className="col" style={{ gap: 8 }}>
        {d.cards.map((c, i) => (
          <div className="editor-row" key={c.id ?? i}>
            <div className="num">{i + 1}</div>
            <textarea className="textarea" rows={1} placeholder="Term / question" value={c.term} onChange={(e) => updateCard(i, { term: e.target.value })} />
            <textarea className="textarea" rows={2} placeholder="Definition / answer" value={c.definition} onChange={(e) => updateCard(i, { definition: e.target.value })} />
            <button className="icon-btn" title="Remove card" onClick={() => setD({ ...d, cards: d.cards.filter((_, j) => j !== i) })}>
              🗑
            </button>
          </div>
        ))}
        <button className="btn" style={{ padding: 16, borderStyle: "dashed" }} onClick={() => setD({ ...d, cards: [...d.cards, { term: "", definition: "" }] })}>
          + Add card
        </button>
      </div>

      <div className="row" style={{ justifyContent: "flex-end", position: "sticky", bottom: 16, zIndex: 5 }}>
        {onCancel && (
          <button className="btn btn-lg" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          className="btn btn-primary btn-lg"
          disabled={valid.length < 1 || !d.title.trim()}
          onClick={() => onSave({ ...d, cards: valid.map((c) => ({ ...c, term: c.term.trim(), definition: c.definition.trim() })) })}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
