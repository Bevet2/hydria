const keys = {
  userId: "hydria:userId",
  conversationId: "hydria:conversationId",
  projectChats: "hydria:projectChats"
};

export const sessionStore = {
  getUserId() {
    return window.localStorage.getItem(keys.userId);
  },
  setUserId(userId) {
    window.localStorage.setItem(keys.userId, String(userId));
  },
  clearUserId() {
    window.localStorage.removeItem(keys.userId);
  },
  getConversationId() {
    return window.localStorage.getItem(keys.conversationId);
  },
  setConversationId(conversationId) {
    window.localStorage.setItem(keys.conversationId, String(conversationId));
  },
  clearConversationId() {
    window.localStorage.removeItem(keys.conversationId);
  },
  getProjectChats() {
    try {
      return JSON.parse(window.localStorage.getItem(keys.projectChats) || "{}");
    } catch {
      return {};
    }
  },
  setProjectChats(map = {}) {
    window.localStorage.setItem(keys.projectChats, JSON.stringify(map || {}));
  },
  linkConversationToProject(projectId, conversationId) {
    if (!projectId || !conversationId) {
      return;
    }
    const map = this.getProjectChats();
    const key = String(projectId);
    const list = Array.isArray(map[key]) ? map[key] : [];
    if (!list.includes(String(conversationId))) {
      map[key] = [String(conversationId), ...list];
      this.setProjectChats(map);
    }
  },
  getProjectConversations(projectId) {
    if (!projectId) {
      return [];
    }
    const map = this.getProjectChats();
    const key = String(projectId);
    return Array.isArray(map[key]) ? map[key] : [];
  }
};
