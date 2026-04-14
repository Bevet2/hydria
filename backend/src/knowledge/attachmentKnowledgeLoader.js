function truncate(text, maxChars = 320) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars - 3)}...`;
}

export function buildKnowledgeEntriesFromAttachments({
  userId,
  conversationId,
  attachments = []
}) {
  return attachments.flatMap((attachment) =>
    (attachment.chunks || []).map((chunk) => ({
      docId: attachment.id,
      userId,
      conversationId,
      attachmentId: attachment.id,
      filename: attachment.originalName,
      kind: attachment.kind,
      contentFamily: attachment.contentFamily,
      parser: attachment.parser,
      sectionTitle: chunk.sectionTitle,
      text: chunk.text,
      excerpt: truncate(chunk.text),
      metadata: {
        score: chunk.score || null,
        profileTags: attachment.profileTags || []
      }
    }))
  );
}

export default {
  buildKnowledgeEntriesFromAttachments
};
