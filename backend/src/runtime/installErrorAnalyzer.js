function extractMissingPackage(output = "") {
  const packageMatch =
    String(output || "").match(/Cannot find module ['"]([^'"./][^'"]*)['"]/i) ||
    String(output || "").match(/missing package:? ([a-z0-9@/_-]+)/i) ||
    String(output || "").match(/ERR_MODULE_NOT_FOUND.*['"]([^'"./][^'"]*)['"]/i);

  return packageMatch?.[1] || "";
}

export function analyzeInstallError(output = "") {
  const text = String(output || "");
  const normalized = text.toLowerCase();

  if (!text.trim()) {
    return {
      type: "install_error",
      retryable: false,
      fixable: false,
      reason: "empty_output"
    };
  }

  if (normalized.includes("enoent") && normalized.includes("package.json")) {
    return {
      type: "missing_package_manifest",
      retryable: false,
      fixable: false,
      reason: "package_json_missing"
    };
  }

  if (normalized.includes("enoent") && normalized.includes(".env")) {
    return {
      type: "missing_env",
      retryable: true,
      fixable: true,
      reason: "env_missing"
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

  if (normalized.includes("network") || normalized.includes("econn") || normalized.includes("etimedout")) {
    return {
      type: "install_error",
      retryable: true,
      fixable: false,
      reason: "network_issue"
    };
  }

  return {
    type: "install_error",
    retryable: false,
    fixable: false,
    reason: "unclassified_install_failure"
  };
}

export default {
  analyzeInstallError
};
