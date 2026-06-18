import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";

export function LoginPage() {
  const { user, login, completeMfa, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "mfa">("login");
  const [challengeToken, setChallengeToken] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === "login") {
        const result = await login(String(data.email), String(data.password));
        if (result.mfaRequired) {
          setChallengeToken(result.challengeToken);
          setMode("mfa");
        }
      } else if (mode === "mfa") {
        await completeMfa(challengeToken, String(data.code));
      } else if (mode === "forgot") {
        const result = await api<{ debugUrl?: string }>("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email: data.email })
        });
        setNotice(result.debugUrl ? `Development reset link: ${result.debugUrl}` : "Check your email for the reset link.");
      } else {
        await register(Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <span className="brand-mark">H</span>
        <p className="eyebrow">Hydria CRM</p>
        <h1>Keep every relationship moving.</h1>
        <p>Contacts, companies, deals and follow-ups in one focused workspace.</p>
      </section>
      <section className="auth-panel">
        {mode !== "mfa" && <div className="segmented">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button>
        </div>}
        <form onSubmit={submit}>
          {mode === "mfa" ? (
            <label>Authentication code<input name="code" inputMode="numeric" autoComplete="one-time-code" minLength={6} required autoFocus /></label>
          ) : (
            <>
          {mode === "register" && (
            <>
              <label>Organization<input name="organizationName" required defaultValue="My workspace" /></label>
              <div className="form-grid">
                <label>First name<input name="firstName" required /></label>
                <label>Last name<input name="lastName" required /></label>
              </div>
            </>
          )}
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          {mode !== "forgot" && <label>Password<input name="password" type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required /></label>}
            </>
          )}
          {error && <p className="form-error">{error}</p>}
          {notice && <p className="form-notice">{notice}</p>}
          <button className="primary-button" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Sign in" : mode === "register" ? "Create workspace" : mode === "forgot" ? "Send reset link" : "Verify"}</button>
          {mode === "login" && <button type="button" className="text-button" onClick={() => setMode("forgot")}>Forgot password?</button>}
          {(mode === "forgot" || mode === "mfa") && <button type="button" className="text-button" onClick={() => setMode("login")}>Back to sign in</button>}
        </form>
      </section>
    </main>
  );
}
