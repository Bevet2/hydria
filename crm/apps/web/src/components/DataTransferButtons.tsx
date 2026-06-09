import { Download, Upload } from "lucide-react";
import { useRef } from "react";
import { api, downloadCsv } from "../api";

export function DataTransferButtons({
  resource,
  canImport,
  onImported
}: {
  resource: "companies" | "leads" | "deals" | "products" | "tasks";
  canImport: boolean;
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  async function importCsv(file?: File) {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    await api(`/data/import/${resource}`, { method: "POST", body });
    if (inputRef.current) inputRef.current.value = "";
    onImported();
  }
  return <>
    {canImport && <input ref={inputRef} hidden type="file" accept=".csv,text/csv" onChange={(event) => importCsv(event.target.files?.[0])} />}
    {canImport && <button className="secondary-button" onClick={() => inputRef.current?.click()}><Upload size={16} />Import</button>}
    <button className="secondary-button" onClick={() => downloadCsv(`/data/export/${resource}.csv`, `${resource}.csv`)}><Download size={16} />Export</button>
  </>;
}
