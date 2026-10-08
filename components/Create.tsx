"use client";

import { useRef, useState } from "react";
import { createSet, updateSet } from "@/lib/store";
import { extractPdfText, fileToBase64 } from "@/lib/pdf";
import { go } from "./App";
import { nudgeGuest } from "./GuestNudge";
import SetForm, { type Draft } from "./SetForm";

type Tab = "pdf" | "text" | "manual";
type Phase = { kind: "input" } | { kind: "working"; step: string; pct?: number } | { kind: "review"; draft: Draft; source?: string };

const MAX_B64_BYTES = 3_200_000; // Vercel request bodies are capped at ~4.5MB

const STEPS = ["Reading your notes…", "Finding key concepts…", "Writing flashcards…", "Polishing definitions…", "Almost there…"];

export default function Create({ initialTab }: { initialTab?: string }) {
  const [tab, setTab] = useState<Tab>(initialTab === "manual" ? "manual" : initialTab === "text" ? "text" : "pdf");
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [count, setCount] = useState<number | "auto">("auto");
  const [style, setStyle] = useState<"terms" | "questions" | "mixed">("terms");
  const [focus, setFocus] = useState("");
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "input" });
  const inputRef = useRef<HTMLInputElement>(null);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const pdfs = Array.from(list).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length === 0) {
      setError("Please choose a PDF file.");
      return;
    }
    setError(null);
    setFiles((f) => [...f, ...pdfs].slice(0, 5));
  };

  const generate = async () => {
    setError(null);
    try {
      let payload: Record<string, unknown> = { count, style, focus: focus.trim() || undefined };
      let source: string | undefined;
      if (tab === "pdf") {
        if (!files.length) return setError("Add at least one PDF first.");
        source = files.map((f) => f.name).join(", ");
        const texts: string[] = [];
        for (let i = 0; i < files.length; i++) {
          setPhase({ kind: "working", step: `Reading ${files[i].name}…`, pct: i / files.length });
          const { text } = await extractPdfText(files[i], (p) =>
            setPhase({ kind: "working", step: `Reading ${files[i].name}…`, pct: (i + p) / files.length })
          );
          texts.push(files.length > 1 ? `# ${files[i].name}\n${text}` : text);
        }
        const joined = texts.join("\n\n");
        const meaningful = joined.replace(/--- Page \d+ ---/g, "").replace(/\s+/g, "").length;
        if (meaningful < 200) {
          // Probably a scanned PDF — let Claude read the document directly.
          if (files.length === 1 && files[0].size <= MAX_B64_BYTES) {
            payload = { ...payload, pdfBase64: await fileToBase64(files[0]), fileName: files[0].name };
          } else {
            throw new Error("This PDF looks scanned (no selectable text) and is too large to send. Try a smaller file (under 3MB) or paste the text instead.");
          }
        } else {
          payload = { ...payload, text: joined, fileName: files.length === 1 ? files[0].name : undefined };
        }
      } else {
        if (text.trim().length < 40) return setError("Paste a bit more text (at least a paragraph).");
        payload = { ...payload, text };
        source = "Pasted text";
      }

      let i = 0;
      setPhase({ kind: "working", step: STEPS[0] });
      stepTimer.current = setInterval(() => {
        i = Math.min(i + 1, STEPS.length - 1);
        setPhase({ kind: "working", step: STEPS[i] });
      }, 3500);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
      if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
      setPhase({
        kind: "review",
        source,
        draft: { title: data.title, description: data.description, emoji: data.emoji, color: Math.floor(Math.random() * 6), cards: data.cards },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPhase({ kind: "input" });
    } finally {
      if (stepTimer.current) clearInterval(stepTimer.current);
    }
  };

  const save = (d: Draft, source?: string) => {
    const id = createSet({ ...d, source });
    if (d.color !== undefined) updateSet(id, { color: d.color });
    go(`/set/${id}`);
    nudgeGuest();
  };

  if (phase.kind === "working") {
    return (
      <div className="card gen-state mt-32 fade-in">
        <div className="orb">✨</div>
        <h2>Forging your flashcards</h2>
        <p className="muted mt-8">{phase.step}</p>
        {phase.pct !== undefined && (
          <div className="study-progress" style={{ maxWidth: 320, margin: "20px auto 0" }}>
            <div style={{ width: `${phase.pct * 100}%` }} />
          </div>
        )}
      </div>
    );
  }

  if (phase.kind === "review") {
    return (
      <div className="mt-32">
        <SetForm
          initial={phase.draft}
          saveLabel="Save & start studying →"
          onCancel={() => setPhase({ kind: "input" })}
          onSave={(d) => save(d, phase.source)}
          banner={
            <div className="spread wrap">
              <div>
                <span className="chip good">✓ Generated {phase.draft.cards.length} cards</span>
                <h1 className="mt-8">Review your set</h1>
                <p className="muted">Tweak anything you like, then save it to your library.</p>
              </div>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ padding: "36px 0 20px" }}>
        <h1>Create a study set</h1>
        <p className="muted mt-8">Upload a PDF and let AI do the busywork — or build one yourself.</p>
      </div>

      <div className="tabs">
        <button className={tab === "pdf" ? "active" : ""} onClick={() => setTab("pdf")}>
          📄 From PDF
        </button>
        <button className={tab === "text" ? "active" : ""} onClick={() => setTab("text")}>
          📋 Paste text
        </button>
        <button className={tab === "manual" ? "active" : ""} onClick={() => setTab("manual")}>
          ✍️ Manual
        </button>
      </div>

      {tab === "manual" ? (
        <div className="mt-24">
          <SetForm initial={{ title: "", description: "", emoji: "📚", color: 0, cards: [] }} onSave={(d) => save(d, "Manual")} />
        </div>
      ) : (
        <div className="col mt-24" style={{ gap: 20 }}>
          {tab === "pdf" ? (
            <>
              <div
                className={`dropzone ${drag ? "drag" : ""}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  addFiles(e.dataTransfer.files);
                }}
              >
                <div className="dz-icon">⬆</div>
                <h3>Drop PDFs here or click to browse</h3>
                <p className="muted mt-8">Lecture slides, notes, textbook chapters — up to 5 files at once</p>
                <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => addFiles(e.target.files)} />
              </div>
              {files.length > 0 && (
                <div className="col" style={{ gap: 8 }}>
                  {files.map((f, i) => (
                    <div key={i} className="card row" style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 22 }}>📄</span>
                      <div className="grow">
                        <div style={{ fontWeight: 600 }}>{f.name}</div>
                        <div className="faint" style={{ fontSize: 12 }}>
                          {(f.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                      <button className="icon-btn" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <textarea className="textarea" style={{ minHeight: 240 }} placeholder="Paste your notes, an article, or a study guide…" value={text} onChange={(e) => setText(e.target.value)} />
          )}

          <div className="card pad options-grid">
            <div>
              <span className="label">Number of cards</span>
              <div className="seg">
                {(["auto", 10, 20, 40] as const).map((n) => (
                  <button key={n} className={count === n ? "active" : ""} onClick={() => setCount(n)}>
                    {n === "auto" ? "Auto" : n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">Card style</span>
              <div className="seg">
                {(
                  [
                    ["terms", "Terms"],
                    ["questions", "Q&A"],
                    ["mixed", "Mixed"],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} className={style === k ? "active" : ""} onClick={() => setStyle(k)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">Focus on (optional)</span>
              <input className="input" placeholder="e.g. chapter 3, key dates" value={focus} onChange={(e) => setFocus(e.target.value)} />
            </div>
          </div>

          {error && <div className="error-box">{error}</div>}

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-primary btn-lg" onClick={generate} disabled={tab === "pdf" ? !files.length : !text.trim()}>
              ✨ Generate flashcards
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
