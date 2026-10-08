"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@/lib/sync";
import { go } from "./App";

const SNOOZE_KEY = "acuity:nudge-snooze";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
const RETURN_KEY = "acuity:return";

const listeners = new Set<() => void>();

/** Call after a guest creates a set: asks them to sign in so it's kept safe (unless snoozed). */
export function nudgeGuest() {
  try {
    if (Date.now() - Number(localStorage.getItem(SNOOZE_KEY) || 0) < SNOOZE_MS) return;
  } catch {}
  listeners.forEach((l) => l());
}

/** Open the account page, remembering where to come back to afterwards. */
export function goSignIn(mode: "signup" | "login" = "signup") {
  try {
    sessionStorage.setItem(RETURN_KEY, window.location.hash);
  } catch {}
  go(`/account?${mode}`);
}

/** Where to go after signing in: back to where goSignIn() was called, or home. */
export function returnAfterSignIn() {
  let back = "";
  try {
    back = sessionStorage.getItem(RETURN_KEY) || "";
    sessionStorage.removeItem(RETURN_KEY);
  } catch {}
  go(back && !back.includes("account") ? back.replace(/^#/, "") : "/");
}

export default function GuestNudge() {
  const account = useAccount();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    listeners.add(show);
    return () => {
      listeners.delete(show);
    };
  }, []);

  if (!open || !account.checked || account.username) return null;

  const notNow = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {}
    setOpen(false);
  };
  const choose = (mode: "signup" | "login") => {
    setOpen(false);
    goSignIn(mode);
  };

  return (
    <div className="modal-bg" role="dialog" aria-modal="true" aria-labelledby="nudge-title" onClick={notNow}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 44 }}>☁️</div>
        <h2 id="nudge-title" className="mt-8">Keep this set safe</h2>
        <p className="muted mt-8">
          Right now it&apos;s saved only in this browser. It won&apos;t show up in other browsers or on your other devices, and
          clearing your browsing data deletes it.
        </p>
        <p className="muted mt-8">Create a free account to save your sets and use them anywhere.</p>
        <button className="btn btn-primary btn-lg mt-24" style={{ width: "100%" }} onClick={() => choose("signup")}>
          Create free account
        </button>
        <div className="row mt-8" style={{ justifyContent: "center", gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => choose("login")}>
            I have an account
          </button>
          <span className="faint">·</span>
          <button className="btn btn-ghost btn-sm" onClick={notNow}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
