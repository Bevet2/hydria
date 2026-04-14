import fs from "node:fs";
import path from "node:path";

export function readPackageJson(workspacePath = "") {
  const packageJsonPath = path.join(workspacePath, "package.json");
  if (!workspacePath || !fs.existsSync(packageJsonPath)) {
    return {
      path: packageJsonPath,
      exists: false,
      data: {}
    };
  }

  try {
    return {
      path: packageJsonPath,
      exists: true,
      data: JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
    };
  } catch {
    return {
      path: packageJsonPath,
      exists: true,
      data: {}
    };
  }
}

export function detectPackageManager(workspacePath = "") {
  if (fs.existsSync(path.join(workspacePath, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (fs.existsSync(path.join(workspacePath, "yarn.lock"))) {
    return "yarn";
  }
  return "npm";
}

export function buildCommand(packageManager = "npm", action = "install") {
  const manager = packageManager || "npm";

  if (action === "install") {
    return manager === "yarn" ? "yarn install" : `${manager} install`;
  }
  if (action === "start") {
    return manager === "yarn" ? "yarn start" : `${manager} start`;
  }
  if (action === "dev") {
    return manager === "yarn" ? "yarn dev" : `${manager} run dev`;
  }
  if (action === "build") {
    return manager === "yarn" ? "yarn build" : `${manager} run build`;
  }
  if (action === "test") {
    return manager === "yarn" ? "yarn test" : `${manager} run test`;
  }

  return `${manager} ${action}`;
}

export default {
  readPackageJson,
  detectPackageManager,
  buildCommand
};
