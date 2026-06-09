import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    api("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token: params.get("token") })
    }).then(() => setState("done")).catch(() => setState("error"));
  }, [params]);

  return <main className="auth-page"><section className="auth-intro"><span className="brand-mark">N</span><h1>Verify your email.</h1></section><section className="auth-panel"><h2>{state === "loading" ? "Verifying..." : state === "done" ? "Email verified" : "Link unavailable"}</h2><p>{state === "done" ? "Your account is verified." : state === "error" ? "This verification link is invalid or expired." : "Please wait."}</p><Link className="primary-button" to="/">Open CRM</Link></section></main>;
}
