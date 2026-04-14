function interfaceError(interfaceName, methodName) {
  return new Error(`${interfaceName}.${methodName} must be implemented.`);
}

export class BrainProvider {
  getName() {
    throw interfaceError("BrainProvider", "getName");
  }

  async generate(_messages, _options = {}) {
    throw interfaceError("BrainProvider", "generate");
  }

  async generateForStep(_step, _messages, _context = {}) {
    throw interfaceError("BrainProvider", "generateForStep");
  }
}

export class Agent {
  getId() {
    throw interfaceError("Agent", "getId");
  }

  async run(_input, _state = {}) {
    throw interfaceError("Agent", "run");
  }
}

export class Tool {
  getDefinition() {
    throw interfaceError("Tool", "getDefinition");
  }

  async execute(_input, _context = {}) {
    throw interfaceError("Tool", "execute");
  }
}

export class MemoryStore {
  async recallContext(_input) {
    throw interfaceError("MemoryStore", "recallContext");
  }

  async appendShortTermEvent(_event) {
    throw interfaceError("MemoryStore", "appendShortTermEvent");
  }

  async setWorkingMemory(_conversationId, _state) {
    throw interfaceError("MemoryStore", "setWorkingMemory");
  }

  async addLongTermMemory(_record) {
    throw interfaceError("MemoryStore", "addLongTermMemory");
  }

  async recordTaskOutcome(_record) {
    throw interfaceError("MemoryStore", "recordTaskOutcome");
  }
}

export class KnowledgeStore {
  async ingestAttachments(_input) {
    throw interfaceError("KnowledgeStore", "ingestAttachments");
  }

  async ingestWebResults(_input) {
    throw interfaceError("KnowledgeStore", "ingestWebResults");
  }

  async ingestGitHubResults(_input) {
    throw interfaceError("KnowledgeStore", "ingestGitHubResults");
  }

  async search(_query, _options = {}) {
    throw interfaceError("KnowledgeStore", "search");
  }
}

export class Evaluator {
  async evaluate(_input) {
    throw interfaceError("Evaluator", "evaluate");
  }
}

export class RuntimeAdapter {
  async executeTool(_toolId, _input, _context = {}) {
    throw interfaceError("RuntimeAdapter", "executeTool");
  }

  async runCommand(_input) {
    throw interfaceError("RuntimeAdapter", "runCommand");
  }

  async navigateBrowser(_input) {
    throw interfaceError("RuntimeAdapter", "navigateBrowser");
  }

  async extractBrowserContent(_input) {
    throw interfaceError("RuntimeAdapter", "extractBrowserContent");
  }

  async listBrowserLinks(_input) {
    throw interfaceError("RuntimeAdapter", "listBrowserLinks");
  }

  async clickBrowser(_input) {
    throw interfaceError("RuntimeAdapter", "clickBrowser");
  }

  async fillBrowser(_input) {
    throw interfaceError("RuntimeAdapter", "fillBrowser");
  }

  async captureBrowserScreenshot(_input) {
    throw interfaceError("RuntimeAdapter", "captureBrowserScreenshot");
  }

  async closeBrowserSession(_sessionId) {
    throw interfaceError("RuntimeAdapter", "closeBrowserSession");
  }

  async describeEnvironment() {
    throw interfaceError("RuntimeAdapter", "describeEnvironment");
  }
}

export default {
  BrainProvider,
  Agent,
  Tool,
  MemoryStore,
  KnowledgeStore,
  Evaluator,
  RuntimeAdapter
};
