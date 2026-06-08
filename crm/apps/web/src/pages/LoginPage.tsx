import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";

export function LoginPage() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === "login") await login(String(data.email), String(data.password));
      else await register(Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <span className="brand-mark">N</span>
        <p className="eyebrow">Northstar CRM</p>
        <h1>Keep every relationship moving.</h1>
        <p>Contacts, companies, deals and follow-ups in one focused workspace.</p>
      </section>
      <section className="auth-panel">
        <div className="segmented">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button>
        </div>
        <form onSubmit={submit}>
          {mode === "register" && (
            <>
              <label>Organization<input name="organizationName" required defaultValue="My workspace" /></label>
              <div className="form-grid">
                <label>First name<input name="firstName" required /></label>
                <label>Last name<input name="lastName" required /></label>
              </div>
            </>
          )}
          <label>Email<input name="email" type="email" required defaultValue={mode === "login" ? "admin@northstar.local" : ""} /></label>
          <label>Password<input name="password" type="password" minLength={8} required defaultValue={mode === "login" ? "Northstar123!" : ""} /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create workspace"}</button>
        </form>
      </section>
    </main>
  );
}
