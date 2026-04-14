export function classifyRuntimeFailure(error) {
  const message = String(error?.message || error || "").toLowerCase();

  if (!message) {
    return "unknown";
  }
  if (message.includes("timed out") || message.includes("timeout")) {
    return "timeout";
  }
  if (message.includes("missing script")) {
    return "missing_script";
  }
  if (message.includes("cannot find module") || message.includes("cannot find package") || message.includes("err_module_not_found")) {
    return "missing_dependency";
  }
  if (message.includes(".env") && (message.includes("missing") || message.includes("enoent"))) {
    return "missing_env";
  }
  if (message.includes("syntaxerror") || message.includes("unexpected token")) {
    return "syntax_error";
  }
  if (message.includes("permission") || message.includes("denied")) {
    return "permission";
  }
  if (message.includes("network") || message.includes("fetch") || message.includes("econn")) {
    return "network";
  }
  if (message.includes("browser") || message.includes("playwright") || message.includes("selector")) {
    return "browser";
  }
  if (message.includes("provider") || message.includes("rate limit") || message.includes("quota")) {
    return "tool_provider";
  }

  return "unknown";
}

export default {
  classifyRuntimeFailure
};
