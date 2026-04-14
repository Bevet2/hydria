export const CLASSIFICATIONS = [
  "simple_chat",
  "complex_reasoning",
  "coding",
  "summarize",
  "compare",
  "brainstorm",
  "data_lookup",
  "hybrid_task",
  "artifact_generation"
];

export const ROUTING_RULES = {
  simple_chat: {
    description: "Short conversational requests",
    llmKinds: ["fast"],
    maxCalls: 1
  },
  coding: {
    description: "Code generation, debugging, stack traces",
    llmKinds: ["code", "reasoning"],
    maxCalls: 2
  },
  complex_reasoning: {
    description: "Architecture, planning, analytical reasoning",
    llmKinds: ["reasoning", "general"],
    maxCalls: 2
  },
  summarize: {
    description: "Summarization and condensation",
    llmKinds: ["general"],
    maxCalls: 1
  },
  compare: {
    description: "Comparison of options or alternatives",
    llmKinds: ["reasoning", "general"],
    maxCalls: 2
  },
  brainstorm: {
    description: "Idea generation and exploration",
    llmKinds: ["general", "reasoning"],
    maxCalls: 2
  },
  data_lookup: {
    description: "Structured external data retrieval",
    llmKinds: ["general"],
    maxCalls: 1
  },
  hybrid_task: {
    description: "External data plus explanation or analysis",
    llmKinds: ["reasoning", "general"],
    maxCalls: 2
  },
  artifact_generation: {
    description: "Document or file generation with orchestration",
    llmKinds: ["agent", "general"],
    maxCalls: 3
  }
};

export function getRoutingRule(classification) {
  return ROUTING_RULES[classification] || ROUTING_RULES.simple_chat;
}
