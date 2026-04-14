import {
  callChatModel,
  callCodeModel,
  callReasoningModel
} from "../../services/providers/llm/llmRouterService.js";
import { BrainProvider } from "../types/contracts.js";

export class HydriaBrainProvider extends BrainProvider {
  getName() {
    return "hydria-llm-router";
  }

  async generate(messages = [], options = {}) {
    return this.complete({
      kind: options.kind || "general",
      messages,
      options
    });
  }

  async generateForStep(step, messages = [], context = {}) {
    return this.complete({
      kind: step?.modelKind || context.kind || "general",
      messages,
      options: {
        model: step?.model,
        modelChain: step?.modelChain,
        ...context.options
      }
    });
  }

  async complete({
    kind = "general",
    messages = [],
    options = {}
  } = {}) {
    switch (kind) {
      case "code":
        return callCodeModel(messages, options);
      case "reasoning":
      case "agent":
        return callReasoningModel(messages, options);
      case "fast":
      case "general":
      default:
        return callChatModel(messages, options);
    }
  }
}

export default HydriaBrainProvider;
