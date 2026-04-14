export class AgentRegistry {
  constructor({ agents = [], toolRegistry = null } = {}) {
    this.agents = agents.filter(Boolean);
    this.toolRegistry = toolRegistry;
  }

  list() {
    const toolIds = this.toolRegistry?.listTools().map((tool) => tool.id) || [];

    return this.agents.map((agent) => {
      const id = agent.getId ? agent.getId() : agent.id;
      const description = agent.describe ? agent.describe() : {
        id,
        label: agent.label || id,
        role: agent.role || ""
      };

      const defaults = {
        planner_agent: {
          domains: ["simple_chat", "data_lookup", "compare", "coding", "complex_reasoning"],
          toolIds: [],
          responsibilities: ["routing", "classification", "task_pack_selection", "plan_building"]
        },
        executor_agent: {
          domains: ["all"],
          toolIds,
          responsibilities: ["tool_execution", "llm_execution", "observation_collection"]
        },
        critic_agent: {
          domains: ["all"],
          toolIds: [],
          responsibilities: ["evaluation", "scoring", "quality_control"]
        },
        memory_agent: {
          domains: ["all"],
          toolIds: ["knowledge_search"],
          responsibilities: ["memory_recall", "memory_commit", "knowledge_ingestion"]
        },
        orchestrator_agent: {
          domains: ["all"],
          toolIds: [],
          responsibilities: ["agent_selection", "step_coordination", "flow_routing"]
        },
        strategy_agent: {
          domains: ["all"],
          toolIds: [],
          responsibilities: ["meta_strategy", "agent_selection", "reasoning_depth_control"]
        },
        research_agent: {
          domains: ["compare", "summarize", "complex_reasoning", "coding", "data_lookup"],
          toolIds: ["knowledge_search", "web_search"],
          responsibilities: ["knowledge_retrieval", "context_preparation", "research_synthesis"]
        },
        api_agent: {
          domains: ["data_lookup", "hybrid_task"],
          toolIds: ["api_lookup"],
          responsibilities: ["api_selection", "api_grounding", "registry_lookup"]
        },
        git_agent: {
          domains: ["github_research", "coding", "data_lookup"],
          toolIds: [
            "search_github_repos",
            "search_github_code",
            "clone_repo",
            "read_repo_file",
            "analyze_repo"
          ],
          responsibilities: ["github_search", "repository_analysis", "pattern_extraction"]
        }
      };

      const agentMeta = defaults[id] || {
        domains: ["all"],
        toolIds: [],
        responsibilities: []
      };

      return {
        ...description,
        domains: agentMeta.domains,
        toolIds: agentMeta.toolIds,
        responsibilities: agentMeta.responsibilities
      };
    });
  }

  get(agentId) {
    return this.list().find((agent) => agent.id === agentId) || null;
  }
}

export default AgentRegistry;
