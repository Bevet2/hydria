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
    throw new Error(payload.error || `Request failed for ${path}`);
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
  listUsers() {
    return request("/api/users");
  },
  createUser(username) {
    return request("/api/users", {
      method: "POST",
      body: JSON.stringify({ username })
    });
  },
  listConversations(userId) {
    return request(`/api/users/${userId}/conversations`);
  },
  createConversation(userId, title) {
    return request("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ userId, title })
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
  createWorkObject(payload = {}) {
    return request("/api/work-objects/new", {
      method: "POST",
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
  updateWorkObjectContent(workObjectId, path, content) {
    return request(`/api/work-objects/${workObjectId}/content`, {
      method: "PATCH",
      body: JSON.stringify({
        entryPath: path,
        content
      })
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
