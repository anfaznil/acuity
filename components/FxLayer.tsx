"use client";

import { useEffect, useRef, useState } from "react";
import { ACHIEVEMENTS, levelTitle, onNotice, onXp, type Notice, type XpEvent } from "@/lib/store";

export function fireConfetti(duration = 2200) {
  if (typeof document === "undefined") return;
  const canvas = document.createElement("canvas");
  canvas.className = "confetti";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const colors = ["#6c47ff", "#ff4f8b", "#12b886", "#ffb800", "#22d3ee", "#ff7a59"];
  const parts = Array.from({ length: 160 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 200,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 16 - 4,
    r: Math.random() * 6 + 4,
    c: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
  }));
  const start = performance.now();
  const tick = (t: number) => {
    const el = t - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - el / duration);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      ctx.restore();
    }
    if (el < duration) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}

type Floating = XpEvent & { x: number; y: number };
type Toast = { id: number; icon: string; title: string; body: string };

export default function FxLayer() {
  const [floats, setFloats] = useState<Floating[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const tid = useRef(0);

  useEffect(() => {
    const offXp = onXp((e) => {
      const anchor = document.getElementById("xp-anchor")?.getBoundingClientRect();
      const x = anchor ? anchor.left + anchor.width / 2 - 30 : innerWidth - 160;
      const y = anchor ? anchor.bottom + 8 : 70;
      setFloats((f) => [...f, { ...e, x, y }]);
      setTimeout(() => setFloats((f) => f.filter((v) => v.id !== e.id)), 1300);
    });
    const push = (t: Omit<Toast, "id">) => {
      const id = ++tid.current;
      setToasts((ts) => [...ts, { ...t, id }]);
      setTimeout(() => setToasts((ts) => ts.filter((v) => v.id !== id)), 4200);
    };
    const offNotice = onNotice((n: Notice) => {
      if (n.kind === "level") {
        setLevelUp(n.level);
        fireConfetti();
      } else if (n.kind === "achievement") {
        const a = ACHIEVEMENTS[n.id];
        if (a) push({ icon: a.icon, title: `Achievement: ${a.name}`, body: a.desc });
      } else if (n.kind === "goal") {
        push({ icon: "🎯", title: "Daily goal reached!", body: "Nice work — keep the streak alive tomorrow." });
      }
    });
    return () => {
      offXp();
      offNotice();
    };
  }, []);

  return (
    <>
      {floats.map((f) => (
        <div key={f.id} className="xp-float" style={{ left: f.x, top: f.y }}>
          +{f.amount} XP
        </div>
      ))}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span className="ti">{t.icon}</span>
            <div>
              <div style={{ fontWeight: 700 }}>{t.title}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {t.body}
              </div>
            </div>
          </div>
        ))}
      </div>
      {levelUp !== null && (
        <div className="modal-bg" onClick={() => setLevelUp(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="level-burst">{levelUp}</div>
            <div className="chip">LEVEL UP</div>
            <h2 className="mt-8">You&apos;re now a {levelTitle(levelUp)}!</h2>
            <p className="muted mt-8">Level {levelUp} unlocked. Your brain thanks you.</p>
            <button className="btn btn-primary btn-lg mt-24" onClick={() => setLevelUp(null)} autoFocus>
              Keep going
            </button>
          </div>
        </div>
      )}
    </>
  );
}
