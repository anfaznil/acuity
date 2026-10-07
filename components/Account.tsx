"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { authenticate, signOut, syncNow, useAccount, type Account as AccountState } from "@/lib/sync";
import { go } from "./App";

export function syncLabel(a: AccountState) {
  if (a.status === "syncing") return "Syncing…";
  if (a.status === "offline") return "Offline — will sync later";
  if (a.status === "error") return a.error || "Sync error";
  if (a.lastSynced) return `Synced ${new Date(a.lastSynced).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return "Connected";
}

export default function Account() {
  const account = useAccount();
  const sets = useStore((s) => s.sets);

  if (!account.checked) return <div style={{ minHeight: "50vh" }} />;
  return account.username ? <SignedIn account={account} setCount={sets.length} /> : <SignInForm localSets={sets.length} />;
}

function SignedIn({ account, setCount }: { account: AccountState; setCount: number }) {
  const [busy, setBusy] = useState(false);

  const doSignOut = async () => {
    setBusy(true);
    let ok = await signOut();
    if (!ok && confirm("Some changes on this device haven't reached the cloud yet. Sign out anyway and lose them?")) {
      ok = await signOut(true);
    }
    setBusy(false);
    if (ok) go("/");
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
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
        <p className="faint mt-16" style={{ fontSize: 13 }}>
          Signing out removes your sets from this device. They stay safe in your account.
        </p>
      </div>
    </div>
  );
}

function SignInForm({ localSets }: { localSets: number }) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await authenticate(mode, username, password);
    setBusy(false);
    if (err) setError(err);
    else go("/");
  };

  return (
    <div className="fade-in" style={{ maxWidth: 440, margin: "0 auto", padding: "48px 0" }}>
      <h1>{mode === "signup" ? "Create an account" : "Welcome back"}</h1>
      <p className="muted mt-8">
        Sign in to keep your sets and progress safe and use them on your phone, tablet and laptop.
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
        <label className="label mt-16" htmlFor="acc-pass">Password</label>
        <input
          id="acc-pass"
          className="input"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={mode === "signup" ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {mode === "signup" && <p className="faint mt-8" style={{ fontSize: 13 }}>At least 8 characters.</p>}
        {error && <div className="error-box mt-16">{error}</div>}
        {localSets > 0 && (
          <p className="muted mt-16" style={{ fontSize: 14 }}>
            The {localSets} set{localSets === 1 ? "" : "s"} on this device will be added to your account.
          </p>
        )}
        <button className="btn btn-primary btn-lg mt-24" style={{ width: "100%" }} disabled={busy}>
          {busy ? "One sec…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
        <p className="center muted mt-16" style={{ fontSize: 14 }}>
          {mode === "signup" ? "Already have an account? " : "New here? "}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError(null);
            }}
          >
            {mode === "signup" ? "Sign in" : "Create one"}
          </button>
        </p>
      </form>
    </div>
  );
}
