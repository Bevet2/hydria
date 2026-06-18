import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";

type SignatureView = {
  signerName: string;
  signerEmail: string;
  expiresAt: string;
  quote: {
    number: string;
    name: string;
    total: number | string;
    organization: { name: string };
    lineItems: Array<{ id: string; description: string; quantity: number | string; lineTotal: number | string }>;
  };
};

export function SignQuotePage() {
  const [params] = useSearchParams();
  const [signature, setSignature] = useState<SignatureView | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    api<{ signature: SignatureView }>(`/commercial/signatures/${encodeURIComponent(params.get("token") || "")}`)
      .then((data) => setSignature(data.signature))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Signature request unavailable"));
  }, [params]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(`/commercial/signatures/${encodeURIComponent(params.get("token") || "")}`, {
        method: "POST",
        body: JSON.stringify({ signerName: data.signerName, signature: data.signature, accepted: true })
      });
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign quote");
    }
  }

  return <main className="auth-page">
    <section className="auth-intro">
      <span className="brand-mark">H</span>
      <p className="eyebrow">{signature?.quote.organization.name || "Hydria CRM"}</p>
      <h1>{signature?.quote.name || "Commercial proposal"}</h1>
      {signature && <p>{signature.quote.number} · {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(signature.quote.total))}</p>}
    </section>
    <section className="auth-panel">
      {error ? <p className="form-error">{error}</p> : done ? <><h2>Quote signed</h2><p>The signed acceptance has been recorded.</p></> : signature ? <>
        <div className="signature-lines">{signature.quote.lineItems.map((item) => <div key={item.id}><span>{item.description} × {Number(item.quantity)}</span><strong>{Number(item.lineTotal).toFixed(2)} EUR</strong></div>)}</div>
        <form onSubmit={submit}>
          <label>Signer name<input name="signerName" required defaultValue={signature.signerName} /></label>
          <label>Signature<input name="signature" required placeholder="Type your full name" /></label>
          <label className="check-label"><input type="checkbox" required />I accept this quote and its terms.</label>
          <button className="primary-button">Sign and accept</button>
        </form>
      </> : <p>Loading...</p>}
    </section>
  </main>;
}
