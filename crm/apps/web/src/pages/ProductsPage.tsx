import {
  BadgeCheck,
  CircleDollarSign,
  Download,
  FileClock,
  FileSignature,
  FileText,
  History,
  Package,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Send,
  Trash2
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, downloadFile } from "../api";
import { useAuth } from "../auth";
import { Dialog } from "../components/Dialog";
import { DataTransferButtons } from "../components/DataTransferButtons";
import { ResourceOperationsBar } from "../components/ResourceOperationsBar";
import type { Product, Quote, QuoteLineItem, User } from "../types";

const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
type Tab = "catalog" | "quotes" | "approvals" | "invoices";
type Approval = { id: string; status: string; quote: Quote & { lineItems: QuoteLineItem[] } };
type Payment = {
  id: string;
  provider: string;
  status: string;
  amount: number | string;
  refundedAmount: number | string;
  paidAt?: string | null;
};
type CreditNote = { id: string; number: string; status: string; amount: number | string; reason?: string | null };
type Invoice = {
  id: string;
  number: string;
  status: string;
  total: number | string;
  currency: string;
  dueAt?: string | null;
  lastReminderAt?: string | null;
  quote: { id: string; number: string; name: string };
  payments: Payment[];
  creditNotes: CreditNote[];
};
type QuoteHistory = {
  versions: Array<{ id: string; version: number; createdAt: string }>;
  approvals: Array<{ id: string; status: string; comment?: string | null; createdAt: string }>;
  signatures: Array<{ id: string; signerName: string; signerEmail: string; status: string; createdAt: string }>;
};

function quoteLine(product?: Product): QuoteLineItem {
  return {
    productId: product?.id || null,
    description: product?.name || "",
    quantity: 1,
    unitPrice: Number(product?.unitPrice || 0),
    discountPercent: 0
  };
}

export function ProductsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("catalog");
  const [products, setProducts] = useState<Product[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quoteStatus, setQuoteStatusFilter] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("");
  const [dialog, setDialog] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [lines, setLines] = useState<QuoteLineItem[]>([]);
  const [history, setHistory] = useState<QuoteHistory | null>(null);
  const [error, setError] = useState("");
  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";
  const canWrite = user?.role !== "VIEWER";

  const load = useCallback(async () => {
    const [productData, quoteData, userData, invoiceData, approvalData] = await Promise.all([
      api<{ products: Product[] }>(`/products?search=${encodeURIComponent(search)}`),
      api<{ quotes: Quote[] }>("/products/quotes"),
      api<{ users: User[] }>("/users"),
      api<{ invoices: Invoice[] }>("/commercial/invoices"),
      api<{ approvals: Approval[] }>("/commercial/approvals/inbox")
    ]);
    setProducts(productData.products);
    setQuotes(quoteData.quotes);
    setUsers(userData.users);
    setInvoices(invoiceData.invoices);
    setApprovals(approvalData.approvals);
  }, [search]);

  useEffect(() => {
    void load().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load commercial data"));
  }, [load]);

  const quoteTotals = useMemo(() => {
    const subtotal = lines.reduce((sum, item) => {
      const total = Number(item.quantity) * Number(item.unitPrice) * (1 - Number(item.discountPercent) / 100);
      return sum + total;
    }, 0);
    return { subtotal };
  }, [lines]);

  function closeDialog() {
    setDialog(null);
    setSelectedProduct(null);
    setSelectedQuote(null);
    setSelectedInvoice(null);
    setSelectedApproval(null);
    setHistory(null);
    setError("");
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const body = {
      name: data.name,
      sku: data.sku,
      unitPrice: Number(data.unitPrice),
      currency: "EUR",
      description: data.description,
      active: selectedProduct ? data.active === "on" : true
    };
    await api(selectedProduct ? `/products/${selectedProduct.id}` : "/products", {
      method: selectedProduct ? "PATCH" : "POST",
      body: JSON.stringify(body)
    });
    closeDialog();
    await load();
  }

  async function editQuote(quote: Quote) {
    const data = await api<{ quote: Quote & { lineItems: QuoteLineItem[] } }>(`/commercial/quotes/${quote.id}`);
    setSelectedQuote(data.quote);
    setLines(data.quote.lineItems || []);
    setDialog("quote");
  }

  async function saveQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedQuote) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api(`/commercial/quotes/${selectedQuote.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: data.name,
        validUntil: data.validUntil ? new Date(String(data.validUntil)).toISOString() : null,
        discountPercent: Number(data.discountPercent),
        taxPercent: Number(data.taxPercent),
        notes: data.notes || null,
        lineItems: lines.map((line) => ({
          productId: line.productId || null,
          description: line.description,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          discountPercent: Number(line.discountPercent)
        }))
      })
    });
    closeDialog();
    await load();
  }

  async function setQuoteStatus(quote: Quote, status: Quote["status"]) {
    await api(`/products/quotes/${quote.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    await load();
  }

  async function removeQuote(quote: Quote) {
    if (!window.confirm(`Delete draft quote ${quote.number}?`)) return;
    await api(`/products/quotes/${quote.id}`, { method: "DELETE" });
    await load();
  }

  async function submitApprovalRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedQuote) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api(`/commercial/quotes/${selectedQuote.id}/approvals`, {
      method: "POST",
      body: JSON.stringify({ reviewerId: data.reviewerId })
    });
    closeDialog();
    await load();
  }

  async function submitApprovalDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedApproval) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api(`/commercial/approvals/${selectedApproval.id}/decision`, {
      method: "POST",
      body: JSON.stringify({ status: data.status, comment: data.comment || undefined })
    });
    closeDialog();
    await load();
  }

  async function submitSignature(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedQuote) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = await api<{ signingUrl: string; emailDelivery?: { delivered: boolean } }>(
      `/commercial/quotes/${selectedQuote.id}/signatures`,
      {
        method: "POST",
        body: JSON.stringify({ signerName: data.signerName, signerEmail: data.signerEmail })
      }
    );
    setError(result.emailDelivery?.delivered ? "Signing request sent." : `Email relay unavailable. Link: ${result.signingUrl}`);
    setDialog(null);
    await load();
  }

  async function submitInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedQuote) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api(`/commercial/quotes/${selectedQuote.id}/invoices`, {
      method: "POST",
      body: JSON.stringify({ dueAt: data.dueAt ? new Date(String(data.dueAt)).toISOString() : null })
    });
    closeDialog();
    setTab("invoices");
    await load();
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedInvoice) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api(`/commercial/invoices/${selectedInvoice.id}/payments`, {
      method: "POST",
      body: JSON.stringify({
        amount: Number(data.amount),
        method: data.method,
        reference: data.reference || undefined
      })
    });
    closeDialog();
    await load();
  }

  async function submitRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedInvoice) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api(`/commercial/payments/${data.paymentId}/refunds`, {
      method: "POST",
      body: JSON.stringify({ amount: Number(data.amount), reason: data.reason })
    });
    closeDialog();
    await load();
  }

  async function submitCredit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedInvoice) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api(`/commercial/invoices/${selectedInvoice.id}/credit-notes`, {
      method: "POST",
      body: JSON.stringify({ amount: Number(data.amount), reason: data.reason, issue: true })
    });
    closeDialog();
    await load();
  }

  async function queueReminder(invoice: Invoice) {
    await api(`/commercial/invoices/${invoice.id}/reminders`, {
      method: "POST",
      body: JSON.stringify({})
    });
    setError(`Reminder queued for ${invoice.number}.`);
    await load();
  }

  async function checkout(invoice: Invoice) {
    const result = await api<{ payment: { checkoutUrl: string } }>(`/commercial/invoices/${invoice.id}/checkout`, {
      method: "POST",
      body: JSON.stringify({
        successUrl: `${window.location.origin}/products?payment=success`,
        cancelUrl: `${window.location.origin}/products?payment=cancel`
      })
    });
    window.location.assign(result.payment.checkoutUrl);
  }

  async function showHistory(quote: Quote) {
    setSelectedQuote(quote);
    setHistory(await api<QuoteHistory>(`/commercial/quotes/${quote.id}/history`));
    setDialog("history");
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Revenue operations</p>
          <h1>Commercial management</h1>
          <p>Catalog, quotes, approvals, invoices and payments</p>
        </div>
        {tab === "catalog" && (
          <div className="header-actions">
            <DataTransferButtons resource="products" canImport={canManage} onImported={load} />
            {canManage && <button className="primary-button" onClick={() => setDialog("product")}><Plus size={16} />Product</button>}
          </div>
        )}
      </header>
      {error && <p className={error.startsWith("Signing") || error.startsWith("Reminder") ? "success-banner" : "settings-error"}>{error}</p>}
      <nav className="commercial-tabs" aria-label="Commercial sections">
        <button className={tab === "catalog" ? "active" : ""} onClick={() => setTab("catalog")}><Package size={16} />Catalog</button>
        <button className={tab === "quotes" ? "active" : ""} onClick={() => setTab("quotes")}><FileText size={16} />Quotes</button>
        <button className={tab === "approvals" ? "active" : ""} onClick={() => setTab("approvals")}><BadgeCheck size={16} />Approvals <b>{approvals.length}</b></button>
        <button className={tab === "invoices" ? "active" : ""} onClick={() => setTab("invoices")}><ReceiptText size={16} />Invoices</button>
      </nav>

      {tab === "catalog" && <section className="panel catalog-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Catalog</p><h2>Products</h2></div>
          <label className="search-field compact"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" /></label>
        </div>
        <ResourceOperationsBar
          resource="PRODUCTS"
          bulkResource="products"
          filters={{ search }}
          onApplyFilters={(filters) => setSearch(String(filters.search || ""))}
          selectedIds={selectedIds}
          onClearSelection={() => setSelectedIds([])}
          onRefresh={load}
          canWrite={canManage}
          actions={[
            { value: "SET_ACTIVE", label: "Set active state", values: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] },
            { value: "DELETE", label: "Delete" }
          ]}
        />
        <div className="product-grid">
          {products.map((product) => <article key={product.id}>
            {canManage && <label className="record-selector inline-selector"><input type="checkbox" checked={selectedIds.includes(product.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} aria-label={`Select ${product.name}`} /></label>}
            <div className="product-mark"><Package size={19} /></div>
            <p><strong>{product.name}</strong><small>{product.sku}</small></p>
            <b>{money.format(Number(product.unitPrice))}</b>
            <span className={product.active ? "active-state" : "inactive-state"}>{product.active ? "Active" : "Inactive"}</span>
            {canManage && <button className="icon-button" title={`Edit ${product.name}`} onClick={() => { setSelectedProduct(product); setDialog("product"); }}><Pencil size={15} /></button>}
          </article>)}
        </div>
      </section>}

      {tab === "quotes" && <section className="panel quotes-panel">
        <div className="panel-heading"><div><p className="eyebrow">Commercial documents</p><h2>Quotes</h2></div><FileText size={19} /></div>
        <ResourceOperationsBar
          resource="QUOTES"
          filters={{ status: quoteStatus }}
          onApplyFilters={(filters) => setQuoteStatusFilter(String(filters.status || ""))}
          selectedIds={[]}
          onClearSelection={() => undefined}
          onRefresh={load}
          canWrite={canWrite}
        />
        <div className="toolbar"><select value={quoteStatus} onChange={(event) => setQuoteStatusFilter(event.target.value)} aria-label="Quote status filter"><option value="">All statuses</option><option>DRAFT</option><option>SENT</option><option>ACCEPTED</option><option>REJECTED</option><option>EXPIRED</option></select></div>
        <div className="quote-list">
          {quotes.filter((quote) => !quoteStatus || quote.status === quoteStatus).map((quote) => <article key={quote.id}>
            <p><strong>{quote.number} · {quote.name}</strong><small>{quote.company?.name || quote.deal?.name || "Quote"} · {quote._count?.lineItems || 0} lines</small></p>
            <b>{money.format(Number(quote.total))}</b>
            <select value={quote.status} disabled={!canWrite} onChange={(event) => void setQuoteStatus(quote, event.target.value as Quote["status"])} aria-label={`Status for ${quote.number}`}>
              <option>DRAFT</option><option>SENT</option><option>ACCEPTED</option><option>REJECTED</option><option>EXPIRED</option>
            </select>
            <div className="quote-actions">
              <button className="icon-button" title="History" onClick={() => void showHistory(quote)}><History size={15} /></button>
              <button className="icon-button" title="Download PDF" onClick={() => void downloadFile(`/products/quotes/${quote.id}/pdf`, `${quote.number}.pdf`)}><Download size={15} /></button>
              {canWrite && quote.status === "DRAFT" && <button className="icon-button" title="Edit quote" onClick={() => void editQuote(quote)}><Pencil size={15} /></button>}
              {canManage && quote.status === "DRAFT" && <button className="icon-button" title="Request approval" onClick={() => { setSelectedQuote(quote); setDialog("approval-request"); }}><BadgeCheck size={15} /></button>}
              {canWrite && quote.status === "SENT" && <button className="icon-button" title="Request signature" onClick={() => { setSelectedQuote(quote); setDialog("signature"); }}><FileSignature size={15} /></button>}
              {canWrite && quote.status === "ACCEPTED" && <button className="icon-button" title="Create invoice" onClick={() => { setSelectedQuote(quote); setDialog("invoice"); }}><ReceiptText size={15} /></button>}
              {canWrite && quote.status === "DRAFT" && <button className="icon-button danger-icon" title="Delete quote" onClick={() => void removeQuote(quote)}><Trash2 size={15} /></button>}
            </div>
          </article>)}
          {!quotes.length && <div className="empty-state"><FileText size={22} /><p>No quote yet.</p></div>}
        </div>
      </section>}

      {tab === "approvals" && <section className="panel quotes-panel">
        <div className="panel-heading"><div><p className="eyebrow">Validation inbox</p><h2>Pending approvals</h2></div><BadgeCheck size={19} /></div>
        <div className="quote-list">
          {approvals.map((approval) => <article key={approval.id}>
            <p><strong>{approval.quote.number} · {approval.quote.name}</strong><small>{approval.quote.lineItems.length} lines awaiting review</small></p>
            <b>{money.format(Number(approval.quote.total))}</b>
            <span className="role-pill">pending</span>
            <button className="secondary-button compact" onClick={() => { setSelectedApproval(approval); setDialog("approval-decision"); }}>Review</button>
          </article>)}
          {!approvals.length && <div className="empty-state"><BadgeCheck size={22} /><p>No pending approval.</p></div>}
        </div>
      </section>}

      {tab === "invoices" && <section className="panel quotes-panel">
        <div className="panel-heading"><div><p className="eyebrow">Billing</p><h2>Invoices</h2></div><ReceiptText size={19} /></div>
        <ResourceOperationsBar
          resource="INVOICES"
          filters={{ status: invoiceStatus }}
          onApplyFilters={(filters) => setInvoiceStatus(String(filters.status || ""))}
          selectedIds={[]}
          onClearSelection={() => undefined}
          onRefresh={load}
          canWrite={canWrite}
        />
        <div className="toolbar"><select value={invoiceStatus} onChange={(event) => setInvoiceStatus(event.target.value)} aria-label="Invoice status filter"><option value="">All statuses</option><option>DRAFT</option><option>ISSUED</option><option>PARTIALLY_PAID</option><option>PAID</option><option>REFUNDED</option><option>VOID</option><option>OVERDUE</option></select></div>
        <div className="quote-list">
          {invoices.filter((invoice) => !invoiceStatus || invoice.status === invoiceStatus).map((invoice) => <article key={invoice.id}>
            <p>
              <strong>{invoice.number} · {invoice.quote.name}</strong>
              <small>{invoice.dueAt ? `Due ${new Date(invoice.dueAt).toLocaleDateString()}` : "No due date"} · {invoice.payments.length} payment(s)</small>
            </p>
            <b>{money.format(Number(invoice.total))}</b>
            <span className="role-pill">{invoice.status.toLowerCase().replaceAll("_", " ")}</span>
            <div className="quote-actions">
              {!["PAID", "REFUNDED", "VOID"].includes(invoice.status) && <button className="icon-button" title="Stripe checkout" onClick={() => void checkout(invoice)}><CircleDollarSign size={15} /></button>}
              {!["PAID", "REFUNDED", "VOID"].includes(invoice.status) && <button className="icon-button" title="Record payment" onClick={() => { setSelectedInvoice(invoice); setDialog("payment"); }}><Plus size={15} /></button>}
              {!["PAID", "REFUNDED", "VOID"].includes(invoice.status) && <button className="icon-button" title="Send reminder" onClick={() => void queueReminder(invoice)}><Send size={15} /></button>}
              {invoice.payments.some((payment) => ["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(payment.status)) && <button className="icon-button" title="Refund payment" onClick={() => { setSelectedInvoice(invoice); setDialog("refund"); }}><RotateCcw size={15} /></button>}
              {!["REFUNDED", "VOID"].includes(invoice.status) && <button className="icon-button" title="Issue credit note" onClick={() => { setSelectedInvoice(invoice); setDialog("credit"); }}><FileClock size={15} /></button>}
            </div>
          </article>)}
          {!invoices.length && <div className="empty-state"><ReceiptText size={22} /><p>No invoice yet.</p></div>}
        </div>
      </section>}

      <Dialog title={selectedProduct ? "Edit product" : "New product"} open={dialog === "product"} onClose={closeDialog}>
        <form className="dialog-form" onSubmit={(event) => void submitProduct(event)}>
          <label>Product name<input name="name" defaultValue={selectedProduct?.name} required /></label>
          <div className="form-grid">
            <label>SKU<input name="sku" defaultValue={selectedProduct?.sku} required /></label>
            <label>Unit price<input name="unitPrice" type="number" min="0" step="0.01" defaultValue={Number(selectedProduct?.unitPrice || 0)} required /></label>
          </div>
          <label>Description<textarea name="description" rows={3} defaultValue={selectedProduct?.description || ""} /></label>
          {selectedProduct && <label className="check-label"><input name="active" type="checkbox" defaultChecked={selectedProduct.active} />Active product</label>}
          <footer><button type="button" className="secondary-button" onClick={closeDialog}>Cancel</button><button className="primary-button">Save</button></footer>
        </form>
      </Dialog>

      <Dialog title={`Edit ${selectedQuote?.number || "quote"}`} open={dialog === "quote"} onClose={closeDialog}>
        {selectedQuote && <form className="dialog-form quote-editor" onSubmit={(event) => void saveQuote(event)}>
          <label>Quote name<input name="name" defaultValue={selectedQuote.name} required /></label>
          <div className="quote-line-editor">
            {lines.map((line, index) => <div className="quote-line-row" key={`${line.id || "new"}-${index}`}>
              <select value={line.productId || ""} onChange={(event) => {
                const product = products.find((item) => item.id === event.target.value);
                setLines((current) => current.map((item, itemIndex) => itemIndex === index ? quoteLine(product) : item));
              }} aria-label={`Product for line ${index + 1}`}>
                <option value="">Custom line</option>
                {products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}
              </select>
              <input value={line.description} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} placeholder="Description" required />
              <input type="number" min="0.01" step="0.01" value={Number(line.quantity)} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item))} aria-label="Quantity" />
              <input type="number" min="0" step="0.01" value={Number(line.unitPrice)} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, unitPrice: Number(event.target.value) } : item))} aria-label="Unit price" />
              <input type="number" min="0" max="100" step="0.01" value={Number(line.discountPercent)} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, discountPercent: Number(event.target.value) } : item))} aria-label="Line discount" />
              <button type="button" className="icon-button danger-icon" title="Remove line" onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button>
            </div>)}
            <button type="button" className="secondary-button" onClick={() => setLines((current) => [...current, quoteLine()])}><Plus size={15} />Add line</button>
          </div>
          <div className="form-grid">
            <label>Global discount (%)<input name="discountPercent" type="number" min="0" max="100" step="0.01" defaultValue={Number(selectedQuote.discountPercent)} /></label>
            <label>Tax (%)<input name="taxPercent" type="number" min="0" max="100" step="0.01" defaultValue={Number(selectedQuote.taxPercent)} /></label>
          </div>
          <div className="form-grid">
            <label>Valid until<input name="validUntil" type="date" defaultValue={selectedQuote.validUntil?.slice(0, 10)} /></label>
            <p className="quote-editor-total"><span>Line subtotal</span><strong>{money.format(quoteTotals.subtotal)}</strong></p>
          </div>
          <label>Notes<textarea name="notes" rows={3} /></label>
          <footer><button type="button" className="secondary-button" onClick={closeDialog}>Cancel</button><button className="primary-button" disabled={!lines.length}>Save new version</button></footer>
        </form>}
      </Dialog>

      <Dialog title="Request approval" open={dialog === "approval-request"} onClose={closeDialog}>
        <form className="dialog-form" onSubmit={(event) => void submitApprovalRequest(event)}>
          <label>Reviewer<select name="reviewerId" required>{users.map((member) => <option value={member.id} key={member.id}>{member.firstName} {member.lastName}</option>)}</select></label>
          <footer><button type="button" className="secondary-button" onClick={closeDialog}>Cancel</button><button className="primary-button">Request approval</button></footer>
        </form>
      </Dialog>

      <Dialog title="Review quote" open={dialog === "approval-decision"} onClose={closeDialog}>
        {selectedApproval && <form className="dialog-form" onSubmit={(event) => void submitApprovalDecision(event)}>
          <div className="approval-summary">
            <strong>{selectedApproval.quote.number} · {selectedApproval.quote.name}</strong>
            {selectedApproval.quote.lineItems.map((line) => <p key={line.id}>{line.description}<span>{line.quantity} × {money.format(Number(line.unitPrice))}</span></p>)}
            <b>{money.format(Number(selectedApproval.quote.total))}</b>
          </div>
          <label>Decision<select name="status"><option>APPROVED</option><option>REJECTED</option></select></label>
          <label>Comment<textarea name="comment" rows={3} /></label>
          <footer><button type="button" className="secondary-button" onClick={closeDialog}>Cancel</button><button className="primary-button">Submit decision</button></footer>
        </form>}
      </Dialog>

      <Dialog title="Request signature" open={dialog === "signature"} onClose={closeDialog}>
        <form className="dialog-form" onSubmit={(event) => void submitSignature(event)}>
          <label>Signer name<input name="signerName" required /></label>
          <label>Signer email<input name="signerEmail" type="email" required /></label>
          <footer><button type="button" className="secondary-button" onClick={closeDialog}>Cancel</button><button className="primary-button">Send request</button></footer>
        </form>
      </Dialog>

      <Dialog title="Create invoice" open={dialog === "invoice"} onClose={closeDialog}>
        <form className="dialog-form" onSubmit={(event) => void submitInvoice(event)}>
          <p>Invoice accepted quote <strong>{selectedQuote?.number}</strong> for {money.format(Number(selectedQuote?.total || 0))}.</p>
          <label>Due date<input name="dueAt" type="date" required /></label>
          <footer><button type="button" className="secondary-button" onClick={closeDialog}>Cancel</button><button className="primary-button">Create invoice</button></footer>
        </form>
      </Dialog>

      <Dialog title="Record payment" open={dialog === "payment"} onClose={closeDialog}>
        <form className="dialog-form" onSubmit={(event) => void submitPayment(event)}>
          <label>Amount<input name="amount" type="number" min="0.01" step="0.01" max={Number(selectedInvoice?.total || 0)} required /></label>
          <label>Method<select name="method"><option>BANK_TRANSFER</option><option>CARD</option><option>CHECK</option><option>CASH</option><option>OTHER</option></select></label>
          <label>Reference<input name="reference" /></label>
          <footer><button type="button" className="secondary-button" onClick={closeDialog}>Cancel</button><button className="primary-button">Record payment</button></footer>
        </form>
      </Dialog>

      <Dialog title="Refund payment" open={dialog === "refund"} onClose={closeDialog}>
        <form className="dialog-form" onSubmit={(event) => void submitRefund(event)}>
          <label>Payment<select name="paymentId" required>{selectedInvoice?.payments.filter((payment) => ["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(payment.status)).map((payment) => <option value={payment.id} key={payment.id}>{payment.provider} · {money.format(Number(payment.amount) - Number(payment.refundedAmount))} refundable</option>)}</select></label>
          <label>Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label>
          <label>Reason<textarea name="reason" rows={3} required /></label>
          <footer><button type="button" className="secondary-button" onClick={closeDialog}>Cancel</button><button className="primary-button">Refund</button></footer>
        </form>
      </Dialog>

      <Dialog title="Issue credit note" open={dialog === "credit"} onClose={closeDialog}>
        <form className="dialog-form" onSubmit={(event) => void submitCredit(event)}>
          <label>Amount<input name="amount" type="number" min="0.01" max={Number(selectedInvoice?.total || 0)} step="0.01" required /></label>
          <label>Reason<textarea name="reason" rows={3} required /></label>
          <footer><button type="button" className="secondary-button" onClick={closeDialog}>Cancel</button><button className="primary-button">Issue credit note</button></footer>
        </form>
      </Dialog>

      <Dialog title={`History ${selectedQuote?.number || ""}`} open={dialog === "history"} onClose={closeDialog}>
        <div className="commercial-history">
          <section><h3>Versions</h3>{history?.versions.map((version) => <p key={version.id}>Version {version.version}<span>{new Date(version.createdAt).toLocaleString()}</span></p>)}</section>
          <section><h3>Approvals</h3>{history?.approvals.map((approval) => <p key={approval.id}>{approval.status.toLowerCase()}<span>{approval.comment || new Date(approval.createdAt).toLocaleString()}</span></p>)}</section>
          <section><h3>Signatures</h3>{history?.signatures.map((signature) => <p key={signature.id}>{signature.signerName} · {signature.status.toLowerCase()}<span>{signature.signerEmail}</span></p>)}</section>
        </div>
      </Dialog>
    </div>
  );
}
