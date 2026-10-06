"use client";

import { useRef } from "react";
import { ACHIEVEMENTS, exportData, importData, levelInfo, levelTitle, masteryStats, setDailyGoal, useStore } from "@/lib/store";
import { Ring } from "./TopBar";
import { downloadJson } from "./SetView";

export default function Profile() {
  const profile = useStore((s) => s.profile);
  const sets = useStore((s) => s.sets);
  const lv = levelInfo(profile.xp);
  const fileRef = useRef<HTMLInputElement>(null);
  const totalCards = sets.reduce((n, s) => n + s.cards.length, 0);
  const mastered = sets.reduce((n, s) => n + masteryStats(s.cards).mastered, 0);

  return (
    <div className="fade-in">
      <div style={{ padding: "36px 0 20px" }}>
        <h1>Your progress</h1>
      </div>
      <div className="card pad-lg row wrap" style={{ gap: 28 }}>
        <Ring pct={lv.pct} size={120} stroke={12}>
          <div className="center">
            <div style={{ fontFamily: "var(--font-display)", fontSize: 34, lineHeight: 1 }}>{lv.level}</div>
            <div className="faint" style={{ fontSize: 11 }}>LEVEL</div>
          </div>
        </Ring>
        <div className="grow">
          <h2>{levelTitle(lv.level)}</h2>
          <p className="muted mt-8">
            {profile.xp.toLocaleString()} total XP · {lv.need - lv.into} XP to level {lv.level + 1}
          </p>
          <div className="study-progress mt-16" style={{ maxWidth: 420 }}>
            <div style={{ width: `${lv.pct * 100}%`, background: "var(--g0)" }} />
          </div>
        </div>
        <div className="stat-grid" style={{ minWidth: 280 }}>
          <div className="stat">
            <div className="stat-val">🔥 {profile.streak}</div>
            <div className="stat-lbl">Day streak</div>
          </div>
          <div className="stat">
            <div className="stat-val">{profile.totalCorrect}</div>
            <div className="stat-lbl">Correct answers</div>
          </div>
          <div className="stat">
            <div className="stat-val">
              {mastered}
              <span className="faint" style={{ fontSize: 16 }}>/{totalCards}</span>
            </div>
            <div className="stat-lbl">Cards mastered</div>
          </div>
          <div className="stat">
            <div className="stat-val">{profile.sessions}</div>
            <div className="stat-lbl">Sessions</div>
          </div>
        </div>
      </div>

      <div className="card pad mt-16 spread wrap">
        <div>
          <h3>Daily XP goal</h3>
          <p className="muted" style={{ fontSize: 13 }}>
            Today: {profile.todayXp} / {profile.dailyGoal} XP
          </p>
        </div>
        <div className="seg">
          {[
            [50, "Casual"],
            [150, "Regular"],
            [300, "Serious"],
            [600, "Intense"],
          ].map(([g, l]) => (
            <button key={g} className={profile.dailyGoal === g ? "active" : ""} onClick={() => setDailyGoal(g as number)}>
              {l} · {g}
            </button>
          ))}
        </div>
      </div>

      <div className="section-head">
        <h2>
          Achievements{" "}
          <span className="faint" style={{ fontSize: 16 }}>
            {profile.achievements.length}/{Object.keys(ACHIEVEMENTS).length}
          </span>
        </h2>
      </div>
      <div className="ach-grid">
        {Object.entries(ACHIEVEMENTS).map(([id, a]) => {
          const has = profile.achievements.includes(id);
          return (
            <div key={id} className={`card ach ${has ? "" : "locked"}`}>
              <div className="ai">{a.icon}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{a.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {a.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-head">
        <div>
          <h2>Backup &amp; sync</h2>
          <p className="muted">Your data lives in this browser. Export a backup to move it to another device.</p>
        </div>
      </div>
      <div className="row wrap">
        <button className="btn" onClick={() => downloadJson(`acuity-backup-${new Date().toLocaleDateString("en-CA")}.json`, exportData())}>
          ⬇ Export everything
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          ⬆ Import backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const n = importData(await f.text());
              alert(`Imported ${n} set${n === 1 ? "" : "s"}.`);
            } catch {
              alert("That file couldn't be imported.");
            }
          }}
        />
      </div>
    </div>
  );
}
