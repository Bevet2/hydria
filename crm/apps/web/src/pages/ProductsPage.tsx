import { FileText, Package, Plus, Search } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Dialog } from "../components/Dialog";
import type { Product, Quote } from "../types";

const money = new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";
  const load = useCallback(() => {
    api<{ products: Product[] }>(`/products?search=${encodeURIComponent(search)}`).then((data) => setProducts(data.products));
    api<{ quotes: Quote[] }>("/products/quotes").then((data) => setQuotes(data.quotes));
  }, [search]);
  useEffect(load, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api("/products", {
      method: "POST",
      body: JSON.stringify({ ...data, unitPrice: Number(data.unitPrice), active: true })
    });
    setOpen(false);
    load();
  }

  async function setQuoteStatus(quote: Quote, status: Quote["status"]) {
    await api(`/products/quotes/${quote.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
  }

  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow">Revenue operations</p><h1>Products & quotes</h1><p>Standardize pricing and commercial proposals</p></div>
        {canManage && <button className="primary-button" onClick={() => setOpen(true)}><Plus size={16} />Product</button>}
      </header>
      <section className="panel catalog-panel">
        <div className="panel-heading"><div><p className="eyebrow">Catalog</p><h2>Active products</h2></div><label className="search-field compact"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" /></label></div>
        <div className="product-grid">
          {products.map((product) => (
            <article key={product.id}>
              <div className="product-mark"><Package size={19} /></div>
              <p><strong>{product.name}</strong><small>{product.sku}</small></p>
              <b>{money.format(Number(product.unitPrice))}</b>
              <span className={product.active ? "active-state" : "inactive-state"}>{product.active ? "Active" : "Inactive"}</span>
            </article>
          ))}
        </div>
      </section>
      <section className="panel quotes-panel">
        <div className="panel-heading"><div><p className="eyebrow">Commercial documents</p><h2>Quotes</h2></div><FileText size={19} /></div>
        <div className="quote-list">
          {quotes.map((quote) => (
            <article key={quote.id}>
              <p><strong>{quote.number} · {quote.name}</strong><small>{quote.company?.name || quote.deal?.name || "Quote"} · {quote._count?.lineItems || 0} lines</small></p>
              <b>{money.format(Number(quote.total))}</b>
              <select value={quote.status} onChange={(event) => setQuoteStatus(quote, event.target.value as Quote["status"])} aria-label={`Status for ${quote.number}`}>
                <option>DRAFT</option><option>SENT</option><option>ACCEPTED</option><option>REJECTED</option><option>EXPIRED</option>
              </select>
            </article>
          ))}
          {!quotes.length && <div className="empty-state"><FileText size={22} /><p>Quotes created from opportunities will appear here.</p></div>}
        </div>
      </section>
      <Dialog title="New product" open={open} onClose={() => setOpen(false)}>
        <form className="dialog-form" onSubmit={create}>
          <label>Product name<input name="name" required /></label>
          <div className="form-grid"><label>SKU<input name="sku" required /></label><label>Unit price<input name="unitPrice" type="number" min="0" step="0.01" required /></label></div>
          <label>Description<textarea name="description" rows={3} /></label>
          <input type="hidden" name="currency" value="EUR" />
          <footer><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button">Create product</button></footer>
        </form>
      </Dialog>
    </div>
  );
}
