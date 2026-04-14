import { execFile } from "node:child_process";
import { promisify } from "node:util";
import config from "../../config/hydria.config.js";

const execFileAsync = promisify(execFile);

function truncate(value = "") {
  const text = String(value || "");
  if (text.length <= config.tools.maxOutputChars) {
    return text;
  }

  return `${text.slice(0, config.tools.maxOutputChars - 3)}...`;
}

export async function runCommand(file, args = [], options = {}) {
  const cwd = options.cwd || config.tools.workspaceRoot;
  const timeout = Math.min(
    Math.max(1000, options.timeoutMs || config.tools.timeoutMs),
    config.tools.timeoutMs
  );

  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      cwd,
      timeout,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 4
    });

    return {
      success: true,
      command: [file, ...args].join(" "),
      stdout: truncate(stdout),
      stderr: truncate(stderr),
      exitCode: 0
    };
  } catch (error) {
    return {
      success: false,
      command: [file, ...args].join(" "),
      stdout: truncate(error.stdout || ""),
      stderr: truncate(error.stderr || error.message || ""),
      exitCode: Number.isInteger(error.code) ? error.code : null,
      error: error.message
    };
  }
}
