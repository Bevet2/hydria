import { Download, File, Paperclip, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, downloadFile } from "../api";
import type { Attachment } from "../types";

type EntityType = "CONTACT" | "COMPANY" | "DEAL" | "LEAD";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsPanel({
  entityType,
  entityId,
  canWrite
}: {
  entityType: EntityType;
  entityId: string;
  canWrite: boolean;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ entityType, entityId });
    api<{ attachments: Attachment[] }>(`/attachments?${params}`)
      .then((data) => setAttachments(data.attachments))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load files"));
  }, [entityId, entityType]);

  useEffect(load, [load]);

  async function upload(file?: File) {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    body.append("entityType", entityType);
    body.append("entityId", entityId);
    try {
      setError("");
      await api("/attachments", { method: "POST", body });
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to upload file");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(attachment: Attachment) {
    if (!window.confirm(`Delete "${attachment.originalName}"?`)) return;
    try {
      await api(`/attachments/${attachment.id}`, { method: "DELETE" });
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete file");
    }
  }

  return (
    <section className="record-section">
      <header>
        <div><h2>Files</h2><p>Documents attached to this record.</p></div>
        {canWrite && (
          <>
            <input ref={fileRef} hidden type="file" onChange={(event) => upload(event.target.files?.[0])} />
            <button className="secondary-button" onClick={() => fileRef.current?.click()}><Upload size={15} />Upload</button>
          </>
        )}
      </header>
      {error && <p className="inline-error">{error}</p>}
      <div className="attachment-list">
        {attachments.map((attachment) => (
          <div key={attachment.id}>
            <span className="file-icon"><File size={16} /></span>
            <p>
              <strong>{attachment.originalName}</strong>
              <small>{formatSize(attachment.size)} - {attachment.uploadedBy.firstName} {attachment.uploadedBy.lastName}</small>
            </p>
            <button className="icon-button" title={`Download ${attachment.originalName}`} onClick={() => downloadFile(`/attachments/${attachment.id}/download`, attachment.originalName)}><Download size={16} /></button>
            {canWrite && <button className="icon-button danger-icon" title={`Delete ${attachment.originalName}`} onClick={() => remove(attachment)}><Trash2 size={15} /></button>}
          </div>
        ))}
        {!attachments.length && <div className="empty-state"><Paperclip size={21} /><p>No files attached.</p></div>}
      </div>
    </section>
  );
}
