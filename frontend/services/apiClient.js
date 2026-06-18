async function request(path, options = {}) {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {})
  };

  const response = await fetch(path, {
    headers,
    ...options
  });

  const payload = await response.json().catch(() => ({
    success: false,
    error: "Invalid server response"
  }));

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.error || `Request failed for ${path}`);
    error.status = response.status;
    error.details = payload.details || null;
    throw error;
  }

  return payload;
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

export const apiClient = {
  getPublicConfig() {
    return request("/api/config/public");
  },
  getHealth() {
    return request("/api/health");
  },
  getHydriaStatus() {
    return request("/api/hydria/status");
  },
  getHydriaCapabilities() {
    return request("/api/hydria/capabilities");
  },
  getHydriaChatCatalog() {
    return request("/api/hydria/chat/catalog");
  },
  getHydriaControlSchema() {
    return request("/api/hydria/control/schema");
  },
  createCrmSession(userId) {
    return request("/api/hydria/crm/session", {
      method: "POST",
      body: JSON.stringify({ userId })
    });
  },
  askHydria(input, options = {}, context = {}) {
    return request("/api/hydria/ask", {
      method: "POST",
      body: JSON.stringify({ input, options, ...context })
    });
  },
  runHydriaControl(payload = {}) {
    return request("/api/hydria/control", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  chatHydriaCore(payload = {}) {
    if (payload.attachments?.length) {
      const formData = new FormData();
      formData.append("userId", String(payload.userId));
      formData.append("conversationId", String(payload.conversationId));
      formData.append("prompt", payload.prompt || "");

      if (payload.projectId) {
        formData.append("projectId", String(payload.projectId));
      }

      if (payload.sessionId) {
        formData.append("sessionId", String(payload.sessionId));
      }

      for (const attachment of payload.attachments) {
        formData.append("attachments", attachment);
      }

      return request("/api/hydria/chat", {
        method: "POST",
        body: formData
      });
    }

    return request("/api/hydria/chat", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async streamHydriaCore(payload = {}, onEvent = () => {}) {
    const formData = new FormData();
    [
      "userId",
      "conversationId",
      "projectId",
      "sessionId",
      "generationId",
      "model",
      "toolMode"
    ].forEach((key) => {
      if (payload[key] !== undefined && payload[key] !== null && payload[key] !== "") {
        formData.append(key, String(payload[key]));
      }
    });
    formData.append("prompt", payload.prompt || "");
    for (const attachment of payload.attachments || []) {
      formData.append("attachments", attachment);
    }
    const response = await fetch("/api/hydria/chat/stream", {
      method: "POST",
      body: formData
    });
    if (!response.ok || !response.body) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || "Hydria Core streaming failed");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";
      for (const block of blocks) {
        let event = "message";
        let data = {};
        block.split("\n").forEach((line) => {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          if (line.startsWith("data:")) {
            try {
              data = JSON.parse(line.slice(5).trim());
            } catch {
              data = { text: line.slice(5).trim() };
            }
          }
        });
        onEvent(event, data);
        if (event === "error") throw new Error(data.error || "Hydria Core streaming failed");
      }
      if (done) break;
    }
  },
  stopHydriaCore(generationId) {
    return request(`/api/hydria/chat/stop/${encodeURIComponent(generationId)}`, {
      method: "POST",
      body: JSON.stringify({})
    });
  },
  listUsers() {
    return request("/api/users");
  },
  createUser(username) {
    return request("/api/users", {
      method: "POST",
      body: JSON.stringify({ username })
    });
  },
  listConversations(userId, params = {}) {
    return request(`/api/users/${userId}/conversations${buildQuery(params)}`);
  },
  createConversation(userId, title, options = {}) {
    return request("/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        userId,
        title,
        projectId: options.projectId || "",
        folder: options.folder || ""
      })
    });
  },
  getConversationTree(userId) {
    return request(`/api/conversations/tree/${encodeURIComponent(userId)}`);
  },
  listChatProjects(userId, archived = false) {
    return request(
      `/api/conversations/projects/${encodeURIComponent(userId)}${buildQuery({
        archived: archived ? 1 : ""
      })}`
    );
  },
  createChatProject(payload = {}) {
    return request("/api/conversations/projects", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateChatProject(projectId, payload = {}) {
    return request(`/api/conversations/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  getMessages(conversationId) {
    return request(`/api/conversations/${conversationId}/messages`);
  },
  clearConversation(conversationId) {
    return request(`/api/conversations/${conversationId}/messages`, {
      method: "DELETE"
    });
  },
  sendChat(payload) {
    if (payload.attachments?.length) {
      const formData = new FormData();
      formData.append("userId", String(payload.userId));

      if (payload.conversationId) {
        formData.append("conversationId", String(payload.conversationId));
      }

      if (payload.workObjectId) {
        formData.append("workObjectId", String(payload.workObjectId));
      }

      if (payload.workObjectPath) {
        formData.append("workObjectPath", String(payload.workObjectPath));
      }

      formData.append("prompt", payload.prompt || "");

      for (const attachment of payload.attachments) {
        formData.append("attachments", attachment);
      }

      return request("/api/chat", {
        method: "POST",
        body: formData
      });
    }

    return request("/api/chat", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  listProjects(userId, conversationId, limit = null) {
    return request(`/api/projects${buildQuery({ userId, conversationId, limit })}`);
  },
  getProject(projectId, userId = null) {
    return request(`/api/projects/${projectId}${buildQuery({ userId })}`);
  },
  getProjectWorkspace(projectId, userId = null, conversationId = null) {
    return request(
      `/api/projects/${projectId}${buildQuery({ userId, conversationId })}`
    );
  },
  listWorkObjects(userId, conversationId) {
    return request(`/api/work-objects${buildQuery({ userId, conversationId })}`);
  },
  updateConversation(conversationId, payload = {}) {
    return request(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  shareConversation(conversationId, userId) {
    return request(`/api/conversations/${conversationId}/share`, {
      method: "POST",
      body: JSON.stringify({ userId })
    });
  },
  branchConversation(conversationId, payload = {}) {
    return request(`/api/conversations/${conversationId}/branch`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  searchWorkObjects(userId, query, kind = "") {
    return request(`/api/work-objects/search${buildQuery({ userId, q: query, kind })}`);
  },
  getWorkObjectHistory(workObjectId) {
    return request(`/api/work-objects/${workObjectId}/history`);
  },
  getWorkObjectHistorySnapshot(workObjectId, historyId) {
    return request(`/api/work-objects/${workObjectId}/history/${historyId}`);
  },
  restoreWorkObjectHistory(workObjectId, historyId) {
    return request(`/api/work-objects/${workObjectId}/history/${historyId}/restore`, {
      method: "POST"
    });
  },
  createWorkObject(payload = {}) {
    return request("/api/work-objects/new", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateWorkObject(workObjectId, payload = {}) {
    return request(`/api/work-objects/${workObjectId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  getWorkObject(workObjectId, filePath = "") {
    return request(
      `/api/work-objects/${workObjectId}${buildQuery(
        filePath ? { content: 1, entryPath: filePath } : {}
      )}`
    );
  },
  calculateSheet(model = {}, engineId = "") {
    return request("/api/sheets/calculate", {
      method: "POST",
      body: JSON.stringify({ model, engineId })
    });
  },
  getWorkObjectCollaboration(workObjectId, params = {}) {
    return request(
      `/api/work-objects/${workObjectId}/collaboration${buildQuery(params)}`
    );
  },
  applyWorkObjectOperation(workObjectId, payload = {}) {
    return request(`/api/work-objects/${workObjectId}/collaboration/operations`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  flushWorkObjectCollaboration(workObjectId, payload = {}) {
    return request(`/api/work-objects/${workObjectId}/collaboration/flush`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  ensureRuntimeSession(workObjectId, payload = {}) {
    return request(`/api/work-objects/${workObjectId}/runtime/session`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  getRuntimeSession(workObjectId, params = {}) {
    return request(
      `/api/work-objects/${workObjectId}/runtime/session${buildQuery(params)}`
    );
  },
  updateRuntimeSession(workObjectId, payload = {}) {
    return request(`/api/work-objects/${workObjectId}/runtime/session`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  resetRuntimeSession(workObjectId, payload = {}) {
    return request(`/api/work-objects/${workObjectId}/runtime/session/reset`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateWorkObjectContent(workObjectId, path, content, options = {}) {
    return request(`/api/work-objects/${workObjectId}/content`, {
      method: "PATCH",
      body: JSON.stringify({
        entryPath: path,
        content,
        userId: options.userId,
        expectedRevision: options.expectedRevision
      })
    });
  },
  updateWorkObjectSharing(workObjectId, payload = {}) {
    return request(`/api/work-objects/${workObjectId}/share`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  updateWorkObjectAnnotations(workObjectId, payload = {}) {
    return request(`/api/work-objects/${workObjectId}/annotations`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  trashWorkObject(workObjectId, userId) {
    return request(`/api/work-objects/${workObjectId}/trash`, {
      method: "POST",
      body: JSON.stringify({ userId })
    });
  },
  restoreTrashedWorkObject(workObjectId, userId) {
    return request(`/api/work-objects/${workObjectId}/restore`, {
      method: "POST",
      body: JSON.stringify({ userId })
    });
  },
  deleteWorkObjectPermanently(workObjectId, userId) {
    return request(`/api/work-objects/${workObjectId}`, {
      method: "DELETE",
      body: JSON.stringify({ userId, confirmation: "DELETE" })
    });
  },
  touchWorkObjectPresence(workObjectId, payload = {}) {
    return request(`/api/work-objects/${workObjectId}/presence`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  leaveWorkObjectPresence(workObjectId, userId) {
    return request(`/api/work-objects/${workObjectId}/presence`, {
      method: "DELETE",
      body: JSON.stringify({ userId })
    });
  },
  improveWorkObject(workObjectId, path, prompt) {
    return request(`/api/work-objects/${workObjectId}/improve`, {
      method: "POST",
      body: JSON.stringify({
        entryPath: path,
        prompt
      })
    });
  },
  getPreferences(userId) {
    return request(`/api/preferences/${userId}`);
  },
  savePreferences(userId, preferences) {
    return request(`/api/preferences/${userId}`, {
      method: "POST",
      body: JSON.stringify(preferences)
    });
  },
  getMemory(userId) {
    return request(`/api/memory/${userId}`);
  }
};
