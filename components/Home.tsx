"use client";

import { useMemo, useRef, useState } from "react";
import { createSet, importData, levelInfo, levelTitle, masteryStats, useStore, type CardSet } from "@/lib/store";
import { go } from "./App";
import { Ring } from "./TopBar";
import { useAccount } from "@/lib/sync";
import { goSignIn } from "./GuestNudge";

export const GRADS = ["var(--g0)", "var(--g1)", "var(--g2)", "var(--g3)", "var(--g4)", "var(--g5)"];

const SAMPLE = {
  title: "Cell Biology Basics",
  description: "A starter set so you can try every game mode.",
  emoji: "🧬",
  cards: [
    { term: "Mitochondria", definition: "Organelle that produces ATP through cellular respiration; the cell's powerhouse." },
    { term: "Ribosome", definition: "Molecular machine that synthesizes proteins by translating mRNA." },
    { term: "Nucleus", definition: "Membrane-bound organelle that stores the cell's DNA and controls gene expression." },
    { term: "Cell membrane", definition: "Phospholipid bilayer that controls what enters and leaves the cell." },
    { term: "Golgi apparatus", definition: "Modifies, sorts and packages proteins and lipids for transport." },
    { term: "Lysosome", definition: "Vesicle containing digestive enzymes that break down waste and debris." },
    { term: "Chloroplast", definition: "Plant organelle where photosynthesis converts light energy into glucose." },
    { term: "Endoplasmic reticulum", definition: "Network of membranes; rough ER makes proteins, smooth ER makes lipids." },
    { term: "Osmosis", definition: "Diffusion of water across a semipermeable membrane toward higher solute concentration." },
    { term: "Mitosis", definition: "Cell division producing two genetically identical daughter cells." },
  ],
};

export function SetTile({ s }: { s: CardSet }) {
  const m = masteryStats(s.cards);
  return (
    <button className="set-tile fade-in" onClick={() => go(`/set/${s.id}`)}>
      <div className="spread">
        <div className="set-emoji" style={{ background: GRADS[s.color % GRADS.length] }}>
          {s.emoji}
        </div>
        <span className="chip plain">{s.cards.length} cards</span>
      </div>
      <div className="grow">
        <h3>{s.title}</h3>
        {s.description && (
          <p className="muted" style={{ fontSize: 13, marginTop: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {s.description}
          </p>
        )}
      </div>
      <div>
        <div className="progress">
          <div className="m" style={{ width: `${(m.mastered / Math.max(1, s.cards.length)) * 100}%` }} />
          <div className="l" style={{ width: `${(m.learning / Math.max(1, s.cards.length)) * 100}%` }} />
        </div>
        <div className="spread mt-8" style={{ fontSize: 12 }}>
          <span className="muted">{Math.round(m.pct * 100)}% mastered</span>
          <span className="faint">{s.lastStudied ? timeAgo(s.lastStudied) : "Not studied yet"}</span>
        </div>
      </div>
    </button>
  );
}

export function timeAgo(t: number) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Home() {
  const sets = useStore((s) => s.sets);
  const account = useAccount();
  const profile = useStore((s) => s.profile);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "name" | "progress">("recent");
  const fileRef = useRef<HTMLInputElement>(null);
  const lv = levelInfo(profile.xp);
  const totalMastered = sets.reduce((n, s) => n + masteryStats(s.cards).mastered, 0);
  const totalCards = sets.reduce((n, s) => n + s.cards.length, 0);

  const filtered = useMemo(() => {
    const list = sets.filter((s) => (s.title + " " + s.description).toLowerCase().includes(q.toLowerCase()));
    return list.sort((a, b) => {
      if (sort === "name") return a.title.localeCompare(b.title);
      if (sort === "progress") return masteryStats(b.cards).pct - masteryStats(a.cards).pct;
      return (b.lastStudied ?? b.updatedAt) - (a.lastStudied ?? a.updatedAt);
    });
  }, [sets, q, sort]);

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const n = importData(await f.text());
      alert(`Imported ${n} set${n === 1 ? "" : "s"}.`);
    } catch {
      alert("That file couldn't be imported.");
    }
  };

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="fade-in">
      <section className="hero">
        <div className="hero-cta">
          <div className="chip" style={{ background: "rgba(255,255,255,.18)", color: "#fff" }}>
            ✨ AI-powered
          </div>
          <h1 className="mt-16">
            {greet}! Drop a PDF,
            <br />
            get flashcards.
          </h1>
          <p>Upload lecture notes, a textbook chapter or study guide — AI turns it into a study set in seconds. Then play your way to mastery.</p>
          <div className="row wrap mt-24">
            <button className="btn btn-lg" onClick={() => go("/create")}>
              📄 Upload a PDF
            </button>
            <button className="btn btn-lg alt" onClick={() => go("/create?manual")}>
              ✍️ Make one by hand
            </button>
          </div>
          <div className="hero-deco">🧠</div>
        </div>
        <div className="col">
          <div className="card pad row" style={{ gap: 18 }}>
            <Ring pct={lv.pct} size={72} stroke={8}>
              <span style={{ fontSize: 20, fontFamily: "var(--font-display)" }}>{lv.level}</span>
            </Ring>
            <div className="grow">
              <div className="stat-lbl">Level {lv.level}</div>
              <h3>{levelTitle(lv.level)}</h3>
              <div className="muted" style={{ fontSize: 13 }}>
                {lv.need - lv.into} XP to level {lv.level + 1}
              </div>
            </div>
          </div>
          <div className="card pad row" style={{ gap: 18 }}>
            <Ring pct={profile.todayXp / profile.dailyGoal} size={72} stroke={8} color="var(--good)">
              {profile.todayXp >= profile.dailyGoal ? "✓" : `${Math.round((profile.todayXp / profile.dailyGoal) * 100)}%`}
            </Ring>
            <div className="grow">
              <div className="stat-lbl">Daily goal</div>
              <h3>
                {profile.todayXp} / {profile.dailyGoal} XP
              </h3>
              <div className="muted" style={{ fontSize: 13 }}>
                {profile.streak > 0 ? `🔥 ${profile.streak}-day streak` : "Earn XP today to start a streak"}
              </div>
            </div>
          </div>
          <div className="stat-grid">
            <div className="stat">
              <div className="stat-val">{sets.length}</div>
              <div className="stat-lbl">Sets</div>
            </div>
            <div className="stat">
              <div className="stat-val">
                {totalMastered}
                <span className="faint" style={{ fontSize: 16 }}>/{totalCards}</span>
              </div>
              <div className="stat-lbl">Mastered</div>
            </div>
          </div>
        </div>
      </section>

      {account.checked && !account.username && sets.length > 0 && (
        <div className="guest-banner mt-24" role="status">
          <span className="guest-banner-icon">⚠️</span>
          <div className="grow">
            <strong>
              Your {sets.length === 1 ? "set is" : `${sets.length} sets are`} only saved in this browser.
            </strong>
            <p style={{ marginTop: 4 }}>
              They won&apos;t appear in other browsers or on your other devices, and clearing your browsing data deletes them.
              Create a free account to keep them safe.
            </p>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => goSignIn("signup")}>
              Create free account
            </button>
            <button className="btn btn-sm" onClick={() => goSignIn("login")}>
              Sign in
            </button>
          </div>
        </div>
      )}

      <div className="section-head">
        <div>
          <h2>Your library</h2>
          <p className="muted">
            {account.username
              ? "Synced to your account on every device."
              : sets.length === 0
                ? "Sign in to save your sets and use them on any device."
                : "Saved in this browser only."}
          </p>
        </div>
        <div className="row wrap">
          <input className="input" style={{ width: 200 }} placeholder="Search sets…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="select" style={{ width: 150 }} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="recent">Recent</option>
            <option value="name">Name</option>
            <option value="progress">Progress</option>
          </select>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
        </div>
      </div>

      {sets.length === 0 ? (
        <div className="empty">
          <div style={{ fontSize: 48 }}>🗂️</div>
          <h3 className="mt-8">No sets yet</h3>
          <p className="muted mt-8">Upload a PDF to forge your first set, or try a sample to explore the games.</p>
          <div className="row wrap mt-16" style={{ justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => go("/create")}>
              Upload a PDF
            </button>
            <button
              className="btn"
              onClick={() => {
                const id = createSet(SAMPLE);
                go(`/set/${id}`);
              }}
            >
              Try a sample set
            </button>
          </div>
        </div>
      ) : (
        <div className="set-grid">
          {filtered.map((s) => (
            <SetTile key={s.id} s={s} />
          ))}
          <button className="set-tile" style={{ borderStyle: "dashed", alignItems: "center", justifyContent: "center" }} onClick={() => go("/create")}>
            <div style={{ fontSize: 32 }}>＋</div>
            <div className="muted" style={{ fontWeight: 600 }}>
              New set
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
