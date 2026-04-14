function extractMissingPackage(output = "") {
  const packageMatch =
    String(output || "").match(/Cannot find package ['"]([^'"]+)['"]/i) ||
    String(output || "").match(/Cannot find module ['"]([^'"./][^'"]*)['"]/i) ||
    String(output || "").match(/ERR_MODULE_NOT_FOUND.*['"]([^'"./][^'"]*)['"]/i);

  return packageMatch?.[1] || "";
}

function extractMissingRelativeImport(output = "") {
  const match = String(output || "").match(/Cannot find module ['"]([^'"]+\.[a-z]+)['"]/i);
  if (!match?.[1] || !match[1].startsWith(".")) {
    return "";
  }

  return match[1];
}

function extractImporterPath(output = "") {
  const match = String(output || "").match(/imported from ([^\s]+\.js)/i);
  return match?.[1] || "";
}

function extractSyntaxFile(output = "") {
  const match = String(output || "").match(/([A-Za-z]:\\[^:\n]+\.js|\S+\.js):\d+/);
  return match?.[1] || "";
}

export function analyzeProjectRunError(output = "") {
  const text = String(output || "");
  const normalized = text.toLowerCase();

  if (!text.trim()) {
    return {
      type: "run_error",
      retryable: false,
      fixable: false,
      reason: "empty_output"
    };
  }

  if (normalized.includes("missing script")) {
    return {
      type: "missing_script",
      retryable: true,
      fixable: true,
      reason: "missing_script"
    };
  }

  if (normalized.includes("eaddrinuse")) {
    return {
      type: "run_error",
      retryable: true,
      fixable: false,
      reason: "port_conflict"
    };
  }

  if (normalized.includes(".env") && (normalized.includes("missing") || normalized.includes("enoent"))) {
    return {
      type: "missing_env",
      retryable: true,
      fixable: true,
      reason: "missing_env"
    };
  }

  const missingPackage = extractMissingPackage(text);
  if (missingPackage) {
    return {
      type: "missing_dependency",
      retryable: true,
      fixable: true,
      reason: "missing_dependency",
      packageName: missingPackage
    };
  }

  const missingImport = extractMissingRelativeImport(text);
  if (missingImport) {
    return {
      type: "broken_import",
      retryable: true,
      fixable: true,
      reason: "broken_import",
      importPath: missingImport,
      importerPath: extractImporterPath(text)
    };
  }

  if (normalized.includes("syntaxerror") || normalized.includes("unexpected token")) {
    return {
      type: "syntax_error",
      retryable: true,
      fixable: true,
      reason: "syntax_error",
      filePath: extractSyntaxFile(text),
      output: text
    };
  }

  if (normalized.includes("timed out") || normalized.includes("timeout")) {
    return {
      type: "timeout",
      retryable: true,
      fixable: false,
      reason: "timeout"
    };
  }

  return {
    type: "run_error",
    retryable: false,
    fixable: false,
    reason: "unclassified_run_failure"
  };
}

export default {
  analyzeProjectRunError
};
