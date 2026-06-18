import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";

const oauthChannelName = "northstar-crm-oauth";

function publish(result: { ok: boolean; state: string; error?: string }) {
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(oauthChannelName);
    channel.postMessage(result);
    channel.close();
  }
  if (window.opener && window.opener !== window) {
    window.opener.postMessage({ type: "northstar-oauth-result", ...result }, "*");
  }
}

export function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("Connecting your account...");

  useEffect(() => {
    const state = params.get("state") || "";
    const code = params.get("code");
    const providerError = params.get("error");
    const providerDescription = params.get("error_description");
    if (!state || providerError || !code) {
      const error = providerDescription || providerError || "The OAuth response is incomplete.";
      setStatus("error");
      setMessage(error);
      publish({ ok: false, state, error });
      return;
    }
    api("/integrations/oauth/callback", {
      method: "POST",
      body: JSON.stringify({ code, state })
    }).then(() => {
      setStatus("done");
      setMessage("Account connected. This window can close.");
      publish({ ok: true, state });
      window.setTimeout(() => window.close(), 250);
    }).catch((cause) => {
      const error = cause instanceof Error ? cause.message : "OAuth connection failed";
      setStatus("error");
      setMessage(error);
      publish({ ok: false, state, error });
    });
  }, [params]);

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <span className="brand-mark">H</span>
        <p className="eyebrow">Hydria CRM</p>
        <h1>Account connection</h1>
      </section>
      <section className="auth-panel">
        <h2>{status === "working" ? "Connecting..." : status === "done" ? "Connected" : "Connection failed"}</h2>
        <p>{message}</p>
        {status !== "working" && <Link className="primary-button" to="/communications">Return to CRM</Link>}
      </section>
    </main>
  );
}
