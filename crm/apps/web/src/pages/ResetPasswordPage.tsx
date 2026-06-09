import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const password = String(new FormData(event.currentTarget).get("password"));
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: params.get("token"), password })
      });
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to reset password");
    }
  }

  return <main className="auth-page"><section className="auth-intro"><span className="brand-mark">N</span><h1>Restore account access.</h1></section><section className="auth-panel"><h2>Reset password</h2>{done ? <p>Password updated. <Link to="/login">Sign in</Link></p> : <form onSubmit={submit}><label>New password<input name="password" type="password" minLength={10} required autoFocus /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button">Update password</button></form>}</section></main>;
}
