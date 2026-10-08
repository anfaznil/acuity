"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  authenticate,
  createRecoveryCode,
  resetPassword,
  signOut,
  syncNow,
  useAccount,
  type Account as AccountState,
} from "@/lib/sync";
import { go } from "./App";
import { returnAfterSignIn } from "./GuestNudge";

export function syncLabel(a: AccountState) {
  if (a.status === "syncing") return "Syncing…";
  if (a.status === "pending") return "Saved here · syncing soon";
  if (a.status === "offline") return "Offline — will sync later";
  if (a.status === "error") return a.error || "Sync error";
  if (a.lastSynced) return `Synced ${new Date(a.lastSynced).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return "Connected";
}

export default function Account({ initialMode }: { initialMode?: "signup" | "login" }) {
  const account = useAccount();
  const sets = useStore((s) => s.sets);
  // A freshly issued recovery code takes over the page until it's been saved.
  const [code, setCode] = useState<string | null>(null);

  if (!account.checked) return <div style={{ minHeight: "50vh" }} />;
  if (code && account.username) {
    return <RecoveryCode code={code} username={account.username} onDone={() => (setCode(null), returnAfterSignIn())} />;
  }
  return account.username ? (
    <SignedIn account={account} setCount={sets.length} onNewCode={setCode} />
  ) : (
    <SignInForm localSets={sets.length} onCode={setCode} initialMode={initialMode} />
  );
}

// ---------- recovery code ----------
function RecoveryCode({ code, username, onDone }: { code: string; username: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      /* clipboard blocked: the code is still selectable */
    }
  };
  const download = () => {
    const text = `Acuity recovery code\n\nUsername: ${username}\nRecovery code: ${code}\n\nUse this on the "Forgot password?" screen at https://acuity-study.vercel.app/#/account\nIt works once; you'll get a new one after using it.\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `acuity-recovery-${username}.txt` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-in" style={{ maxWidth: 480, margin: "0 auto", padding: "48px 0" }}>
      <h1>Save your recovery code</h1>
      <p className="muted mt-8">
        If you ever forget your password, this code lets you set a new one. It&apos;s shown only now, so keep it somewhere
        safe, like your Notes app or a screenshot.
      </p>
      <div className="card pad-lg mt-24 center">
        <div className="label">Recovery code for @{username}</div>
        <div className="recovery-code" aria-label="Recovery code">
          {code}
        </div>
        <div className="row wrap mt-16" style={{ gap: 10, justifyContent: "center" }}>
          <button className="btn" onClick={copy}>
            {copied ? "✓ Copied" : "📋 Copy"}
          </button>
          <button className="btn" onClick={download}>
            ⬇ Save as file
          </button>
        </div>
      </div>
      <label className="row mt-24" style={{ gap: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>I&apos;ve saved my recovery code</span>
      </label>
      <button className="btn btn-primary btn-lg mt-16" style={{ width: "100%" }} disabled={!saved} onClick={onDone}>
        Continue
      </button>
    </div>
  );
}

// ---------- signed in ----------
function SignedIn({ account, setCount, onNewCode }: { account: AccountState; setCount: number; onNewCode: (c: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [askPassword, setAskPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const doSignOut = async () => {
    setBusy(true);
    let ok = await signOut();
    if (!ok && confirm("Some changes on this device haven't reached the cloud yet. Sign out anyway and lose them?")) {
      ok = await signOut(true);
    }
    setBusy(false);
    if (ok) go("/");
  };

  const newCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await createRecoveryCode(password);
    setBusy(false);
    if (r.error) setError(r.error);
    else onNewCode(r.recoveryCode!);
  };

  return (
    <div className="fade-in" style={{ maxWidth: 560, margin: "0 auto", padding: "48px 0" }}>
      <h1>Your account</h1>
      <p className="muted mt-8">Your sets and progress sync automatically to every device you sign in on.</p>
      <div className="card pad-lg mt-24">
        <div className="spread wrap" style={{ gap: 16 }}>
          <div>
            <div className="label">Signed in as</div>
            <h2>@{account.username}</h2>
          </div>
          <span className={`chip ${account.status === "synced" ? "good" : account.status === "error" ? "bad" : account.status === "offline" ? "warn" : "plain"}`}>
            ☁️ {syncLabel(account)}
          </span>
        </div>
        <p className="muted mt-16">
          {setCount} set{setCount === 1 ? "" : "s"} saved to your account.
        </p>
        <div className="row wrap mt-24" style={{ gap: 12 }}>
          <button className="btn" onClick={() => void syncNow()} disabled={account.status === "syncing"}>
            ↻ Sync now
          </button>
          <button className="btn btn-danger" onClick={doSignOut} disabled={busy}>
            {busy && !askPassword ? "Signing out…" : "Sign out"}
          </button>
        </div>
        <p className="faint mt-16" style={{ fontSize: 13 }}>
          Signing out removes your sets from this device. They stay safe in your account.
        </p>
      </div>

      <div className="card pad-lg mt-16">
        <h3>Recovery code</h3>
        <p className="muted mt-8">
          Lost your code, or never saved one? Make a new one. Your old code will stop working.
        </p>
        {askPassword ? (
          <form className="mt-16" onSubmit={newCode}>
            <label className="label" htmlFor="acc-cur">Current password</label>
            <input
              id="acc-cur"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
            {error && <div className="error-box mt-16">{error}</div>}
            <div className="row wrap mt-16" style={{ gap: 12 }}>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? "One sec…" : "Create new code"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => (setAskPassword(false), setError(null))}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button className="btn mt-16" onClick={() => setAskPassword(true)}>
            🔑 Create a new recovery code
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- signed out ----------
type Mode = "signup" | "login" | "reset";
const TITLES: Record<Mode, string> = { signup: "Create an account", login: "Welcome back", reset: "Reset your password" };

function SignInForm({ localSets, onCode, initialMode }: { localSets: number; onCode: (c: string) => void; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode ?? "signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchTo = (m: Mode) => {
    setMode(m);
    setError(null);
    setPassword("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = mode === "reset" ? await resetPassword(username, code, password) : await authenticate(mode, username, password);
    setBusy(false);
    if (r.error) setError(r.error);
    else if (r.recoveryCode) onCode(r.recoveryCode);
    else returnAfterSignIn();
  };

  return (
    <div className="fade-in" style={{ maxWidth: 440, margin: "0 auto", padding: "48px 0" }}>
      <h1>{TITLES[mode]}</h1>
      <p className="muted mt-8">
        {mode === "reset"
          ? "Enter your username and the recovery code you saved when you signed up, then choose a new password."
          : "Sign in to keep your sets and progress safe and use them on your phone, tablet and laptop."}
      </p>
      <form className="card pad-lg mt-24" onSubmit={submit}>
        <label className="label" htmlFor="acc-user">Username</label>
        <input
          id="acc-user"
          className="input"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        {mode === "reset" && (
          <>
            <label className="label mt-16" htmlFor="acc-code">Recovery code</label>
            <input
              id="acc-code"
              className="input"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </>
        )}
        <label className="label mt-16" htmlFor="acc-pass">{mode === "reset" ? "New password" : "Password"}</label>
        <input
          id="acc-pass"
          className="input"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={mode === "login" ? undefined : 8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {mode !== "login" && <p className="faint mt-8" style={{ fontSize: 13 }}>At least 8 characters.</p>}
        {mode === "login" && (
          <button type="button" className="btn btn-ghost btn-sm mt-8" style={{ padding: "2px 6px" }} onClick={() => switchTo("reset")}>
            Forgot password?
          </button>
        )}
        {error && <div className="error-box mt-16">{error}</div>}
        {localSets > 0 && (
          <p className="muted mt-16" style={{ fontSize: 14 }}>
            The {localSets} set{localSets === 1 ? "" : "s"} on this device will be added to your account.
          </p>
        )}
        <button className="btn btn-primary btn-lg mt-24" style={{ width: "100%" }} disabled={busy}>
          {busy ? "One sec…" : mode === "signup" ? "Create account" : mode === "login" ? "Sign in" : "Reset password & sign in"}
        </button>
        <p className="center muted mt-16" style={{ fontSize: 14 }}>
          {mode === "signup" ? "Already have an account? " : mode === "login" ? "New here? " : "Remembered it? "}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => switchTo(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Create one" : "Sign in"}
          </button>
        </p>
        {mode === "reset" && (
          <p className="faint center mt-8" style={{ fontSize: 13 }}>
            Lost your recovery code too? Ask whoever runs this app to reset it for you.
          </p>
        )}
      </form>
    </div>
  );
}
