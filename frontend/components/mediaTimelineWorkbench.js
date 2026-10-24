import {
  appendMediaClip,
  calculateMediaDuration,
  editMediaClip,
  moveMediaClip,
  parseMediaTimeline,
  removeMediaClip
} from "./mediaStudioModel.js";

function element(tag, className = "", content = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}

function button(label, action, { disabled = false, className = "" } = {}) {
  const node = element("button", className, label);
  node.type = "button";
  node.disabled = disabled;
  node.addEventListener("click", action);
  return node;
}

export function renderMediaTimelineWorkbench(container, content = "", { onContentChange = null } = {}) {
  let model = parseMediaTimeline(content);
  if (!model) return false;
  let selectedClipId = model.clips[0]?.id || "";
  const kind = model.kind === "hydria-audio-timeline" ? "audio" : "video";

  const commit = (next) => {
    model = next;
    onContentChange?.(JSON.stringify(model, null, 2));
    render();
  };

  const render = () => {
    container.replaceChildren();
    const shell = element("section", "hydria-media-editor");
    shell.setAttribute("aria-label", kind === "video" ? "Timeline vidéo" : "Timeline audio");
    const toolbar = element("div", "hydria-media-toolbar");
    const header = element("div", "hydria-media-header");
    header.append(
      element("strong", "", kind === "video" ? "Montage · Timeline" : "Voix & audio · Timeline"),
      element("span", "muted", `${model.clips.length} segments · ${calculateMediaDuration(model).toLocaleString("fr-FR")} s`)
    );
    toolbar.append(header);
    toolbar.append(button("+ Ajouter un segment", () => {
      try {
        const next = appendMediaClip(model, { title: `Segment ${model.clips.length + 1}` });
        selectedClipId = next.clips.at(-1).id;
        commit(next);
      } catch (error) {
        status.textContent = error.message;
      }
    }, { className: "secondary-button" }));
    shell.append(toolbar);

    const columns = element("div", "hydria-media-columns");
    const timeline = element("div", "hydria-media-track");
    const trackHeading = element("h3", "", kind === "video" ? "Plans et séquences" : "Segments audio");
    timeline.append(trackHeading);
    if (model.clips.length === 0) {
      timeline.append(element("p", "muted", "La timeline est vide. Ajoutez votre premier segment."));
    }
    model.clips.forEach((clip, index) => {
      const row = element("div", "hydria-media-clip");
      const select = button(`${index + 1}. ${clip.title || "Sans titre"}`, () => {
        selectedClipId = clip.id;
        render();
      }, { className: `hydria-media-select${clip.id === selectedClipId ? " is-active" : ""}` });
      select.title = clip.title;
      select.setAttribute("aria-pressed", String(clip.id === selectedClipId));
      const duration = element("small", "hydria-media-duration", `${clip.durationSeconds} s`);
      const actions = element("div", "hydria-media-actions");
      const up = button("↑", () => commit(moveMediaClip(model, clip.id, -1)), { disabled: index === 0 });
      const down = button("↓", () => commit(moveMediaClip(model, clip.id, 1)), { disabled: index === model.clips.length - 1 });
      up.setAttribute("aria-label", `Déplacer ${clip.title} vers le haut`);
      down.setAttribute("aria-label", `Déplacer ${clip.title} vers le bas`);
      actions.append(up, down);
      row.append(select, duration, actions);
      timeline.append(row);
    });

    const inspector = element("div", "hydria-media-inspector");
    const selected = model.clips.find((clip) => clip.id === selectedClipId);
    inspector.append(element("h3", "", "Inspecteur de segment"));
    if (selected) {
      const form = element("form", "hydria-media-form");
      const fields = [
        ["title", "Titre", "text", 120],
        ["durationSeconds", "Durée (secondes)", "number", 20],
        ["script", "Script / notes", "textarea", 4000],
        ["visual", kind === "video" ? "Direction visuelle" : "Ambiance sonore", "textarea", 4000],
        ["voiceover", "Narration / voix", "textarea", 4000]
      ];
      for (const [field, labelText, type, maxLength] of fields) {
        const label = element("label", "", labelText);
        const input = document.createElement(type === "textarea" ? "textarea" : "input");
        if (type !== "textarea") input.type = type;
        input.name = field;
        input.value = selected[field] ?? "";
        if (type === "number") {
          input.min = "0.1"; input.max = "21600"; input.step = "0.1";
        } else input.maxLength = maxLength;
        label.appendChild(input);
        form.append(label);
      }
      const controls = element("div", "hydria-media-form-actions");
      controls.append(button("Supprimer le segment", () => {
        const next = removeMediaClip(model, selected.id);
        selectedClipId = next.clips[0]?.id || "";
        commit(next);
      }, { className: "secondary-button" }));
      const save = element("button", "primary-button", "Appliquer les modifications");
      save.type = "submit";
      controls.append(save);
      form.append(controls);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form));
        try {
          commit(editMediaClip(model, selected.id, values));
        } catch (error) {
          status.textContent = error.message;
        }
      });
      inspector.append(form);
    } else inspector.append(element("p", "muted", "Choisissez un segment pour le modifier."));
    columns.append(timeline, inspector);
    shell.append(columns);
    const status = element("p", "hydria-media-status muted", "Projet éditable et sauvegardé dans Hydria. Génération IA, pistes média et rendu final à connecter.");
    status.setAttribute("role", "status");
    shell.append(status);
    container.append(shell);
  };
  render();
  return true;
}
