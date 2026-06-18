import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "../api";
import type { Ticket } from "../types";

export function CustomerPortalPage() {
  const { portalToken = "" } = useParams();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [devCode, setDevCode] = useState("");
  const sessionKey = `northstar_portal_session:${portalToken}`;
  const [portalSession, setPortalSession] = useState(
    () => sessionStorage.getItem(sessionKey) || ""
  );
  const load = useCallback(() => {
    if (!portalSession) return;
    publicApi<{ ticket: Ticket }>(
      `/tickets/portal/${portalToken}`,
      {},
      portalSession
    )
      .then((payload) => setTicket(payload.ticket))
      .catch((cause) => {
        sessionStorage.removeItem(sessionKey);
        setPortalSession("");
        setTicket(null);
        setError(cause instanceof Error ? cause.message : "Portal unavailable");
      });
  }, [portalSession, portalToken, sessionKey]);
  useEffect(load, [load]);

  async function requestAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const payload = await publicApi<{ sent: boolean; devCode?: string }>(
        `/tickets/portal/${portalToken}/request-access`,
        { method: "POST", body: JSON.stringify({ email }) }
      );
      setCodeRequested(true);
      setDevCode(payload.devCode || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send access code");
    }
  }

  async function verifyAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      const payload = await publicApi<{ token: string }>(
        `/tickets/portal/${portalToken}/session`,
        {
          method: "POST",
          body: JSON.stringify({ email, code: String(form.get("code") || "") })
        }
      );
      sessionStorage.setItem(sessionKey, payload.token);
      setPortalSession(payload.token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid access code");
    }
  }

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await publicApi(
      `/tickets/portal/${portalToken}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name") || ""),
          body: String(form.get("body") || "")
        })
      },
      portalSession
    );
    event.currentTarget.reset();
    load();
  }

  if (!portalSession) return <main className="customer-portal">
    <header><span className="brand-mark">H</span><div><strong>Hydria support</strong><small>Secure customer portal</small></div></header>
    <section>
      <p className="eyebrow">Ticket access</p>
      <h1>Open your support request</h1>
      {!codeRequested ? <form onSubmit={(event) => void requestAccess(event)}>
        <label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <button className="primary-button">Send access code</button>
      </form> : <form onSubmit={(event) => void verifyAccess(event)}>
        <label>Six-digit code<input name="code" inputMode="numeric" pattern="[0-9]{6}" required defaultValue={devCode} /></label>
        {devCode && <small>Development code: {devCode}</small>}
        <button className="primary-button">Open ticket</button>
      </form>}
      {error && <p className="form-error">{error}</p>}
    </section>
  </main>;
  if (!ticket) return <main className="customer-portal"><p>{error || "Loading support request..."}</p></main>;
  return <main className="customer-portal">
    <header><span className="brand-mark">H</span><div><strong>Hydria support</strong><small>{ticket.number}</small></div></header>
    <section>
      <p className="eyebrow">{ticket.status.replaceAll("_", " ")}</p>
      <h1>{ticket.subject}</h1>
      <p>{ticket.description}</p>
      <div className="portal-messages">{(ticket.messages || []).map((message) => <article key={message.id} className={message.inbound ? "customer" : "support"}>
        <strong>{message.inbound ? message.authorName || "You" : "Support"}</strong>
        <p>{message.body}</p>
        <small>{new Date(message.createdAt).toLocaleString()}</small>
      </article>)}</div>
      <form onSubmit={(event) => void reply(event)}>
        <label>Name<input name="name" required /></label>
        <label>Message<textarea name="body" required rows={5} /></label>
        <button className="primary-button">Send reply</button>
      </form>
    </section>
  </main>;
}
