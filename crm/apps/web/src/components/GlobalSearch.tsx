import { Building2, Contact, Package, Search, Target, UserRoundSearch, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

type SearchResult = {
  id: string;
  type: "contact" | "company" | "lead" | "deal" | "product";
  label: string;
  meta: string;
  path: string;
};

const icons = {
  contact: Contact,
  company: Building2,
  lead: UserRoundSearch,
  deal: Target,
  product: Package
};

export function GlobalSearch() {
  const navigate = useNavigate();
  const timer = useRef<number>();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = window.setTimeout(() => {
      api<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(query)}`)
        .then((data) => {
          setResults(data.results);
          setOpen(true);
        })
        .catch(() => setResults([]));
    }, 220);
    return () => window.clearTimeout(timer.current);
  }, [query]);

  function choose(result: SearchResult) {
    navigate(result.path);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="global-search">
      <Search size={17} />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder="Search CRM"
        aria-label="Search CRM"
      />
      {query && (
        <button className="icon-button" onClick={() => { setQuery(""); setOpen(false); }} aria-label="Clear search">
          <X size={15} />
        </button>
      )}
      {open && (
        <>
          <button className="search-scrim" onClick={() => setOpen(false)} aria-label="Close search" />
          <div className="search-results">
            {results.map((result) => {
              const Icon = icons[result.type];
              return (
                <button key={`${result.type}-${result.id}`} onClick={() => choose(result)}>
                  <span><Icon size={16} /></span>
                  <p><strong>{result.label}</strong><small>{result.type} · {result.meta}</small></p>
                </button>
              );
            })}
            {!results.length && <p className="search-empty">No matching records.</p>}
          </div>
        </>
      )}
    </div>
  );
}
