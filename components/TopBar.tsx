"use client";

import { useEffect, useState } from "react";
import { levelInfo, useStore } from "@/lib/store";
import { go, type Route } from "./App";

export function Ring({ pct, size = 64, stroke = 7, color = "var(--primary)", children }: { pct: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, pct)))}
          style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.9,.3,1)" }}
        />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

export default function TopBar({ route }: { route: Route }) {
  const profile = useStore((s) => s.profile);
  const lv = levelInfo(profile.xp);
  const [theme, setTheme] = useState<string>("light");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || "light");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("acuity:theme", next);
    } catch {}
    setTheme(next);
  };

  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <button className="logo" onClick={() => go("/")}>
          <span className="logo-mark">⚡</span>
          <span>Acuity</span>
        </button>
        <nav className="nav">
          <button className={route.name === "home" ? "active" : ""} onClick={() => go("/")}>
            Library
          </button>
          <button className={route.name === "create" ? "active" : ""} onClick={() => go("/create")}>
            Create
          </button>
          <button className={route.name === "profile" ? "active" : ""} onClick={() => go("/profile")}>
            Progress
          </button>
        </nav>
        <div className="hud">
          <button className="hud-pill" title={`${profile.streak}-day streak`} onClick={() => go("/profile")}>
            <span className={`streak ${profile.streak ? "" : "off"}`}>🔥</span>
            {profile.streak}
          </button>
          <button className="hud-pill" title={`${lv.into} / ${lv.need} XP to level ${lv.level + 1}`} onClick={() => go("/profile")} id="xp-anchor">
            <span className="level-badge">{lv.level}</span>
            <span className="xpbar">
              <div style={{ width: `${lv.pct * 100}%` }} />
            </span>
            <span className="hide-sm">{profile.xp.toLocaleString()} XP</span>
          </button>
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button className="btn btn-primary btn-sm hide-sm" onClick={() => go("/create")}>
            + New set
          </button>
        </div>
      </div>
    </header>
  );
}
