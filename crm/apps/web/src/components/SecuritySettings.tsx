import { Laptop, MailCheck, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, setSession } from "../api";
import { useAuth } from "../auth";
import { Dialog } from "./Dialog";

type Session = {
  id: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  lastUsedAt: string;
};

export function SecuritySettings() {
  const { user, refreshUser } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaSecret, setMfaSecret] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await api<{ sessions: Session[]; currentSessionId: string | null }>("/auth/sessions");
    setSessions(data.sessions);
    setCurrentSessionId(data.currentSessionId);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function requestVerification() {
    const result = await api<{ debugUrl?: string }>("/auth/verification/request", { method: "POST" });
    setNotice(result.debugUrl || "Verification email sent.");
  }

  async function setupMfa() {
    const result = await api<{ secret: string }>("/auth/mfa/setup", { method: "POST" });
    setMfaSecret(result.secret);
    setRecoveryCodes([]);
    setMfaOpen(true);
  }

  async function enableMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const code = String(new FormData(event.currentTarget).get("code"));
      const result = await api<{ recoveryCodes: string[] }>("/auth/mfa/enable", {
        method: "POST",
        body: JSON.stringify({ code })
      });
      setRecoveryCodes(result.recoveryCodes);
      await refreshUser();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to enable MFA");
    }
  }

  async function disableMfa() {
    const code = window.prompt("Enter your current authentication code");
    if (!code) return;
    await api("/auth/mfa/disable", { method: "POST", body: JSON.stringify({ code }) });
    await refreshUser();
  }

  async function revokeSession(session: Session) {
    if (!window.confirm("Revoke this session?")) return;
    await api(`/auth/sessions/${session.id}`, { method: "DELETE" });
    if (session.id === currentSessionId) {
      setSession(null);
      window.location.assign("/login");
      return;
    }
    await load();
  }

  return <>
    <section className="settings-section">
      <div className="section-title"><div><ShieldCheck size={19} /><span><h2>Account security</h2><p>Email verification and multi-factor authentication</p></span></div></div>
      <div className="security-actions">
        <div><MailCheck size={18} /><p><strong>Email</strong><small>{user?.emailVerifiedAt ? "Verified" : "Verification required"}</small></p>{!user?.emailVerifiedAt && <button className="secondary-button" onClick={requestVerification}>Verify</button>}</div>
        <div><Smartphone size={18} /><p><strong>Authenticator</strong><small>{user?.mfaEnabled ? "Enabled" : "Disabled"}</small></p><button className="secondary-button" onClick={user?.mfaEnabled ? disableMfa : setupMfa}>{user?.mfaEnabled ? "Disable" : "Enable"}</button></div>
      </div>
      {notice && <p className="form-notice">{notice}</p>}
    </section>
    <section className="settings-section">
      <div className="section-title"><div><Laptop size={19} /><span><h2>Active sessions</h2><p>Devices currently authorized for this account</p></span></div><button className="secondary-button" onClick={() => api("/auth/logout-all", { method: "POST" }).then(() => { setSession(null); window.location.assign("/login"); })}>Revoke all</button></div>
      <div className="member-list">{sessions.map((session) => <div key={session.id}><Laptop size={18} /><p><strong>{session.id === currentSessionId ? "Current session" : session.userAgent?.slice(0, 80) || "Unknown device"}</strong><small>{session.ipAddress || "Unknown IP"} · {new Date(session.lastUsedAt).toLocaleString()}</small></p><button className="icon-button danger-icon" title="Revoke session" onClick={() => revokeSession(session)}><Trash2 size={15} /></button></div>)}</div>
    </section>
    <Dialog title="Enable authenticator" open={mfaOpen} onClose={() => setMfaOpen(false)}>
      {recoveryCodes.length ? <div className="dialog-form"><p>Store these recovery codes securely.</p><code className="recovery-codes">{recoveryCodes.join("\n")}</code><footer><button className="primary-button" onClick={() => setMfaOpen(false)}>Done</button></footer></div> : <form className="dialog-form" onSubmit={enableMfa}><label>Authenticator secret<input readOnly value={mfaSecret} /></label><label>Six-digit code<input name="code" inputMode="numeric" minLength={6} maxLength={6} required /></label>{error && <p className="form-error">{error}</p>}<footer><button type="button" className="secondary-button" onClick={() => setMfaOpen(false)}>Cancel</button><button className="primary-button">Enable MFA</button></footer></form>}
    </Dialog>
  </>;
}
