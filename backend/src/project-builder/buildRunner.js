export async function runProjectBuild({ runtimeAdapter, workspacePath = "", commands = [] } = {}) {
  if (!runtimeAdapter || !workspacePath || !commands.length) {
    return {
      status: "skipped",
      command: "",
      output: ""
    };
  }

  const command = commands[0];
  const result = await runtimeAdapter.runCommand({
    command,
    cwd: workspacePath
  });

  return {
    status: result.success ? "passed" : "failed",
    command,
    output: result.output || result.error || ""
  };
}

export default {
  runProjectBuild
};
