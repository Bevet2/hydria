import { FormEvent, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import type { User } from "../types";

export function AcceptInvitationPage() {
  const { user, adoptSession } = useAuth();
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const password = String(new FormData(event.currentTarget).get("password"));
      const result = await api<{ token: string; refreshToken: string; user: User }>("/auth/accept-invitation", {
        method: "POST",
        body: JSON.stringify({ token: params.get("token"), password })
      });
      adoptSession(result.token, result.refreshToken, result.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to accept invitation");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page"><section className="auth-intro"><span className="brand-mark">N</span><h1>Join your CRM workspace.</h1></section><section className="auth-panel"><h2>Accept invitation</h2><form onSubmit={submit}><label>Choose a password<input name="password" type="password" minLength={10} required autoFocus /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? "Please wait..." : "Create account"}</button></form></section></main>;
}
