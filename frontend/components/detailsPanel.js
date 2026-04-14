function renderTokenList(element, values = []) {
  element.innerHTML = "";
  if (!values.length) {
    const empty = document.createElement("span");
    empty.className = "detail-item";
    empty.textContent = "None";
    element.appendChild(empty);
    return;
  }

  for (const value of values) {
    const token = document.createElement("span");
    token.className = "token";
    token.textContent = value;
    element.appendChild(token);
  }
}

function renderDetailStack(element, values = [], formatter = (value) => value) {
  element.innerHTML = "";
  if (!values.length) {
    const empty = document.createElement("span");
    empty.className = "detail-item";
    empty.textContent = "None";
    element.appendChild(empty);
    return;
  }

  for (const value of values) {
    const item = document.createElement("div");
    item.className = "detail-item";
    item.textContent = formatter(value);
    element.appendChild(item);
  }
}

function renderArtifacts(element, values = []) {
  element.innerHTML = "";

  if (!values.length) {
    const empty = document.createElement("span");
    empty.className = "detail-item";
    empty.textContent = "None";
    element.appendChild(empty);
    return;
  }

  for (const artifact of values) {
    const item = document.createElement("div");
    item.className = "detail-item";

    if (artifact.type === "generated_file" && artifact.downloadUrl) {
      const link = document.createElement("a");
      link.className = "detail-link";
      link.href = artifact.downloadUrl;
      const formatLabel = artifact.format?.toUpperCase?.() || artifact.format || "file";
      const extensionLabel =
        artifact.extension && artifact.extension !== artifact.format
          ? ` / ${String(artifact.extension).toUpperCase()}`
          : "";
      link.textContent = `${artifact.filename} (${formatLabel}${extensionLabel})`;
      item.appendChild(link);

      const meta = document.createElement("span");
      meta.textContent = ` | ${artifact.mimeType || "-"} | ${artifact.sizeBytes || 0} bytes`;
      item.appendChild(meta);
    } else {
      item.textContent = `${artifact.type?.toUpperCase?.() || "ARTIFACT"} | ${artifact.provider || artifact.capability || artifact.purpose || "-"} | ${artifact.error || artifact.filename || "no details"}`;
    }

    element.appendChild(item);
  }
}

export function renderRunDetails(result, elements) {
  elements.classification.textContent = result?.classification || "-";
  elements.strategy.textContent = result?.strategy || "-";
  elements.duration.textContent = result?.meta?.durationMs
    ? `${result.meta.durationMs} ms`
    : "-";

  renderDetailStack(
    elements.taskPack,
    result?.taskPack
      ? [
          `${result.taskPack.label} | ${result.taskPack.id} | confidence: ${result.taskPack.confidence}`,
          result.taskPack.reason,
          `shape: ${result.taskPack.responseShape}`
        ]
      : []
  );
  renderDetailStack(
    elements.routing,
    result?.routing
      ? [
          `resolved: ${result.routing.resolvedPrompt || "-"}`,
          `used history: ${result.routing.usedHistory ? "yes" : "no"}${result.routing.reason ? ` | reason: ${result.routing.reason}` : ""}`,
          result.routing.previousPrompt ? `previous: ${result.routing.previousPrompt}` : null
        ].filter(Boolean)
      : []
  );
  renderDetailStack(
    elements.followUps,
    result?.followUpActions || result?.plan?.followUpActions || [],
    (action) =>
      `${action.kind || "-"} | ${action.id || "-"} | ${action.label || action.resolvedPrompt || "-"}`
  );
  renderDetailStack(
    elements.judge,
    result?.judge
      ? [
          `mode: ${result.judge.mode || "-"} | decision: ${result.judge.decision || "-"} | confidence: ${result.judge.confidence || "-"} | score: ${result.judge.score ?? "-"}`,
          ...(result.judge.issues || []).map((issue) => `issue: ${issue}`),
          ...(result.judge.candidateEvaluations || []).map(
            (evaluation) =>
              `${evaluation.type.toUpperCase()} | ${evaluation.provider || evaluation.model || "-"} | score ${evaluation.score} | ${evaluation.rejected ? "rejected" : evaluation.confidence}${evaluation.issues?.length ? ` | ${evaluation.issues.join(", ")}` : ""}`
          )
        ]
      : []
  );
  renderTokenList(elements.models, result?.modelsUsed || []);
  renderTokenList(elements.apis, result?.apisUsed || []);
  renderTokenList(elements.tools, result?.toolsUsed || []);
  renderDetailStack(
    elements.memory,
    result?.memoryUsed || [],
    (memory) => `[${memory.type}] ${memory.content}`
  );
  renderDetailStack(
    elements.plan,
    result?.plan?.steps || [],
    (step) =>
      `${step.type.toUpperCase()} | ${step.provider || step.model || "pending"} | ${step.purpose || step.capability || "-"}${step.error ? ` | error: ${step.error}` : ""}`
  );
  renderDetailStack(
    elements.candidates,
    result?.candidates || [],
    (candidate) =>
      `${candidate.type.toUpperCase()} | ${candidate.provider || candidate.model || "-"} | ${candidate.preview || ""}`
  );
  renderDetailStack(
    elements.sources,
    result?.sourcesUsed || [],
    (source) =>
      `${source.type.toUpperCase()} | ${source.provider || "-"} | ${source.model || source.capability || "-"}`
  );
  renderDetailStack(
    elements.delivery,
    result?.delivery
      ? [
          `status: ${result.delivery.status || "-"}`,
          `workspace: ${result.delivery.workspacePath || result.project?.workspacePath || "-"}`,
          result.delivery.export?.downloadUrl
            ? `export: ${result.delivery.export.filename} -> ${result.delivery.export.downloadUrl}`
            : null,
          `install: ${result.delivery.install?.status || "skipped"}`,
          `run: ${result.delivery.run?.status || "skipped"}`,
          `validation: ${result.delivery.validation?.status || "skipped"}`,
          ...(result.delivery.correctionsApplied || []).map(
            (item) => `fix: ${item.summary || item}`
          ),
          result.delivery.nextCommand
            ? `next: ${result.delivery.nextCommand}`
            : null
        ].filter(Boolean)
      : []
  );
  renderDetailStack(
    elements.attachments,
    result?.attachments || [],
    (attachment) =>
      `${attachment.originalName} | ${attachment.kind} | ${attachment.contentFamily || "-"} | parser: ${attachment.parser || "-"} | extractor: ${attachment.extractorId || "-"} | ${attachment.parseStatus} | sections: ${attachment.sectionCount || 0} | chunks: ${attachment.chunkCount || 0}${attachment.profileTags?.length ? ` | tags: ${attachment.profileTags.join(", ")}` : ""}${attachment.excerpt ? ` | ${attachment.excerpt}` : ""}`
  );
  renderDetailStack(
    elements.evidence,
    result?.attachmentEvidenceUsed || [],
    (evidence) =>
      `${evidence.filename} | ${evidence.sectionTitle} | score ${evidence.score} | ${evidence.excerpt || ""}`
  );
  renderArtifacts(elements.artifacts, result?.artifacts || []);
}
