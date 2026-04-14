import { spawn, spawnSync } from "node:child_process";

function stringifyArg(value) {
  return /[\s"]/g.test(String(value || ""))
    ? `"${String(value || "").replace(/"/g, '\\"')}"`
    : String(value || "");
}

function shouldUseWindowsCommandShell(command = "") {
  return process.platform === "win32" && /\.(cmd|bat)$/i.test(String(command || ""));
}

function spawnProcess(command, args = [], options = {}) {
  if (shouldUseWindowsCommandShell(command)) {
    const commandLine = [stringifyArg(command), ...args.map((arg) => stringifyArg(arg))].join(" ");
    return spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", commandLine], {
      cwd: options.cwd,
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        ...(options.env || {})
      }
    });
  }

  return spawn(command, args, {
    cwd: options.cwd,
    shell: false,
    windowsHide: true,
    env: {
      ...process.env,
      ...(options.env || {})
    }
  });
}

export function runCommand(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawnProcess(command, args, options);

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timeout = null;

    function finish(result) {
      if (settled) {
        return;
      }

      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }

      resolve({
        success: result.success,
        command: [command, ...args].map(stringifyArg).join(" "),
        stdout,
        stderr,
        exitCode: result.exitCode ?? null,
        durationMs: Date.now() - startedAt,
        error: result.error || null
      });
    }

    if (options.timeoutMs) {
      timeout = setTimeout(() => {
        try {
          child.kill("SIGTERM");
        } catch {}

        finish({
          success: false,
          exitCode: null,
          error: `Command timed out after ${options.timeoutMs}ms`
        });
      }, options.timeoutMs);
    }

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      finish({
        success: false,
        exitCode: null,
        error: error.message
      });
    });

    child.on("close", (exitCode) => {
      finish({
        success: exitCode === 0,
        exitCode
      });
    });
  });
}

function createChild(command, args = [], options = {}) {
  return spawnProcess(command, args, options);
}

function killChildProcess(child) {
  if (!child || child.killed) {
    return;
  }

  try {
    if (process.platform === "win32" && child.pid) {
      spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
        windowsHide: true
      });
      return;
    }
    child.kill("SIGTERM");
  } catch {}
}

export function runMonitoredCommand(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = createChild(command, args, options);
    let stdout = "";
    let stderr = "";
    let settled = false;
    let monitorTimeout = null;
    let shutdownTimeout = null;
    let readyMatched = false;
    const readyPatterns = Array.isArray(options.readyPatterns) && options.readyPatterns.length
      ? options.readyPatterns
      : [
          /\blistening\b/i,
          /\bready\b/i,
          /\bstarted\b/i,
          /http:\/\/localhost:\d+/i
        ];

    function finish(result) {
      if (settled) {
        return;
      }

      settled = true;
      if (monitorTimeout) {
        clearTimeout(monitorTimeout);
      }
      if (shutdownTimeout) {
        clearTimeout(shutdownTimeout);
      }

      resolve({
        success: result.success,
        command: [command, ...args].map(stringifyArg).join(" "),
        stdout,
        stderr,
        output: [stdout, stderr].filter(Boolean).join("\n").trim(),
        exitCode: result.exitCode ?? null,
        durationMs: Date.now() - startedAt,
        error: result.error || null,
        readyMatched,
        timedOutWhileRunning: Boolean(result.timedOutWhileRunning)
      });
    }

    function markSuccess(reason = "process stayed alive without crashing") {
      const graceMs = Math.max(100, Number(options.graceMs || 500));
      shutdownTimeout = setTimeout(() => {
        killChildProcess(child);
        finish({
          success: true,
          exitCode: null,
          timedOutWhileRunning: true,
          error: reason
        });
      }, graceMs);
    }

    child.stdout?.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      if (!readyMatched && readyPatterns.some((pattern) => pattern.test(text))) {
        readyMatched = true;
      }
    });

    child.stderr?.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      if (!readyMatched && readyPatterns.some((pattern) => pattern.test(text))) {
        readyMatched = true;
      }
    });

    child.on("error", (error) => {
      finish({
        success: false,
        exitCode: null,
        error: error.message
      });
    });

    child.on("close", (exitCode) => {
      if (settled) {
        return;
      }

      if (readyMatched && exitCode === 0) {
        finish({
          success: true,
          exitCode
        });
        return;
      }

      finish({
        success: false,
        exitCode,
        error: stderr.trim() || stdout.trim() || "Process exited before readiness confirmation"
      });
    });

    monitorTimeout = setTimeout(() => {
      if (settled) {
        return;
      }

      if (readyMatched || !child.killed) {
        markSuccess(
          readyMatched
            ? "readiness detected"
            : "process stayed alive without crashing"
        );
        return;
      }

      finish({
        success: false,
        exitCode: null,
        error: "Process ended before readiness timeout"
      });
    }, Math.max(1000, Number(options.timeoutMs || 8000)));
  });
}

export default {
  runCommand,
  runMonitoredCommand
};
