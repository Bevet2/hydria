import {
  addCadBox,
  addGeoPoint,
  geoCoordinateBounds,
  geoCoordinates,
  parseCadScene,
  parseGeoCollection,
  projectIsometricPoint
} from "./spatialStudioModel.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function make(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function svgElement(tag, attrs = {}, text = "") {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text) node.textContent = text;
  return node;
}

function labeledInput(labelText, name, value = "", type = "text") {
  const label = make("label", "", labelText);
  const input = make("input");
  input.name = name;
  input.type = type;
  input.value = value;
  input.required = true;
  if (type === "number") input.step = "any";
  else input.maxLength = 120;
  label.append(input);
  return label;
}

function editorButton(label, action, className = "secondary-button") {
  const node = make("button", className, label);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}

function createFrame(title, summary) {
  const shell = make("section", "hydria-spatial-editor");
  const heading = make("div", "hydria-spatial-heading");
  heading.append(make("strong", "", title), make("small", "muted", summary));
  const columns = make("div", "hydria-spatial-columns");
  const viewport = make("div", "hydria-spatial-viewport");
  const sidebar = make("aside", "hydria-spatial-inspector");
  columns.append(viewport, sidebar);
  shell.append(heading, columns);
  return { shell, viewport, sidebar };
}

export function renderGeoWorkbench(container, content = "", { onContentChange = null } = {}) {
  let collection = parseGeoCollection(content);
  if (!collection) return false;
  const commit = (next) => {
    collection = next;
    onContentChange?.(JSON.stringify(collection, null, 2));
    render();
  };
  const render = () => {
    const { shell, viewport, sidebar } = createFrame("GIS · Explorateur GeoJSON", `${collection.features.length} entités · WGS 84 (EPSG:4326)`);
    const graphic = svgElement("svg", { viewBox: "0 0 800 460", role: "img", "aria-label": "Visualisation simplifiée des entités géographiques" });
    graphic.append(svgElement("rect", { x: 0, y: 0, width: 800, height: 460, fill: "#f1f5f9" }));
    for (let x = 80; x < 800; x += 80) graphic.append(svgElement("line", { x1: x, y1: 0, x2: x, y2: 460, stroke: "#dce4ef" }));
    for (let y = 60; y < 460; y += 80) graphic.append(svgElement("line", { x1: 0, y1: y, x2: 800, y2: y, stroke: "#dce4ef" }));
    const bounds = geoCoordinateBounds(collection) || [-1, -1, 1, 1];
    const spanLon = Math.max(bounds[2] - bounds[0], .01);
    const spanLat = Math.max(bounds[3] - bounds[1], .01);
    const centerLon = (bounds[0] + bounds[2]) / 2;
    const centerLat = (bounds[1] + bounds[3]) / 2;
    const spread = Math.max(spanLon / 680, spanLat / 360);
    const project = ([lon, lat]) => [400 + (lon - centerLon) / spread, 230 - (lat - centerLat) / spread];
    collection.features.slice(0, 500).forEach((feature, index) => {
      const points = geoCoordinates(feature.geometry).slice(0, 4000).map(project);
      if (!points.length) return;
      const isPolygon = /Polygon/.test(feature.geometry.type);
      const isLine = /LineString/.test(feature.geometry.type);
      let shape;
      if (isPolygon && points.length >= 3) {
        shape = svgElement("polygon", { points: points.map((p) => p.join(",")).join(" "), fill: "#99f6e4", "fill-opacity": .58, stroke: "#0f766e", "stroke-width": 2 });
      } else if (isLine && points.length >= 2) {
        shape = svgElement("polyline", { points: points.map((p) => p.join(",")).join(" "), fill: "none", stroke: "#2563eb", "stroke-width": 3 });
      } else {
        shape = svgElement("circle", { cx: points[0][0], cy: points[0][1], r: 7, fill: "#4f46e5", stroke: "white", "stroke-width": 2 });
      }
      shape.append(svgElement("title", {}, String(feature.properties?.name || `Entité ${index + 1}`)));
      graphic.append(shape);
    });
    viewport.append(graphic);
    viewport.append(make("p", "muted hydria-spatial-note", "Aperçu local des géométries — sans fond cartographique ni transformation de projection."));
    sidebar.append(make("h3", "", "Ajouter un point"));
    const form = make("form", "hydria-spatial-form");
    form.append(labeledInput("Nom", "name", "Nouveau point"), labeledInput("Longitude", "longitude", "2.3522", "number"), labeledInput("Latitude", "latitude", "48.8566", "number"));
    const action = make("button", "primary-button", "Ajouter à la carte");
    action.type = "submit";
    const status = make("p", "hydria-spatial-status muted");
    status.setAttribute("role", "status");
    form.append(action, status);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      try { commit(addGeoPoint(collection, Object.fromEntries(new FormData(form)))); }
      catch (error) { status.textContent = error.message; }
    });
    sidebar.append(form);
    sidebar.append(make("h3", "", "Entités"));
    const list = make("ul", "hydria-spatial-list");
    collection.features.slice(0, 100).forEach((feature, index) => {
      const row = make("li", "", `${feature.properties?.name || `Entité ${index + 1}`} · ${feature.geometry.type}`);
      row.append(editorButton("Retirer", () => commit({ ...collection, features: collection.features.filter((_, i) => i !== index) })));
      list.append(row);
    });
    sidebar.append(list);
    container.replaceChildren(shell);
  };
  render();
  return true;
}

function boxVertices(object) {
  const [x, y, z] = object.position;
  const [width, depth, height] = object.size;
  return [
    [x, y, z], [x + width, y, z], [x, y + depth, z], [x + width, y + depth, z],
    [x, y, z + height], [x + width, y, z + height], [x, y + depth, z + height], [x + width, y + depth, z + height]
  ].map(projectIsometricPoint);
}

export function renderCadWorkbench(container, content = "", { onContentChange = null } = {}) {
  let scene = parseCadScene(content);
  if (!scene) return false;
  const commit = (next) => {
    scene = next;
    onContentChange?.(JSON.stringify(scene, null, 2));
    render();
  };
  const render = () => {
    const { shell, viewport, sidebar } = createFrame("3D Studio · Volumes", `${scene.objects.length} objet(s) · unités : ${scene.units || "m"}`);
    const graphic = svgElement("svg", { viewBox: "0 0 800 460", role: "img", "aria-label": "Aperçu isométrique des volumes" });
    graphic.append(svgElement("rect", { width: 800, height: 460, fill: "#f8fafc" }));
    const projected = scene.objects.slice(0, 100).map((item) => ({ item, vertices: boxVertices(item) }));
    const vertices = projected.flatMap((item) => item.vertices);
    const minX = Math.min(0, ...vertices.map((p) => p.x));
    const maxX = Math.max(1, ...vertices.map((p) => p.x));
    const minY = Math.min(-1, ...vertices.map((p) => p.y));
    const maxY = Math.max(1, ...vertices.map((p) => p.y));
    const scale = Math.min(680 / (maxX - minX || 1), 340 / (maxY - minY || 1), 65);
    const screen = ({ x, y }) => [400 + (x - (minX + maxX) / 2) * scale, 230 + (y - (minY + maxY) / 2) * scale];
    const faces = [[2, 3, 7, 6], [1, 3, 7, 5], [4, 5, 7, 6]];
    const colors = ["#818cf8", "#6366f1", "#c7d2fe"];
    for (const { item, vertices: box } of projected) {
      faces.forEach((face, index) => {
        const shape = svgElement("polygon", {
          points: face.map((vertex) => screen(box[vertex]).join(",")).join(" "),
          fill: colors[index], stroke: "#3730a3", "stroke-width": 1.6
        });
        shape.append(svgElement("title", {}, item.name));
        graphic.append(shape);
      });
    }
    viewport.append(graphic, make("p", "muted hydria-spatial-note", "Projection isométrique de volumes. Modélisation CAO avancée, matériaux et exports 3D à connecter."));
    sidebar.append(make("h3", "", "Ajouter un volume"));
    const form = make("form", "hydria-spatial-form");
    form.append(labeledInput("Nom", "name", "Nouveau volume"), labeledInput("Largeur (m)", "width", "3", "number"), labeledInput("Profondeur (m)", "depth", "2", "number"), labeledInput("Hauteur (m)", "height", "2.5", "number"));
    const action = make("button", "primary-button", "Ajouter le volume");
    action.type = "submit";
    const status = make("p", "hydria-spatial-status muted");
    status.setAttribute("role", "status");
    form.append(action, status);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const { name, width, depth, height } = Object.fromEntries(new FormData(form));
      try { commit(addCadBox(scene, { name, size: [width, depth, height] })); }
      catch (error) { status.textContent = error.message; }
    });
    sidebar.append(form);
    sidebar.append(make("h3", "", "Volumes"));
    const list = make("ul", "hydria-spatial-list");
    scene.objects.slice(0, 100).forEach((object) => {
      const row = make("li", "", `${object.name} · ${object.size.join(" × ")} m`);
      row.append(editorButton("Retirer", () => commit({ ...scene, objects: scene.objects.filter((item) => item.id !== object.id) })));
      list.append(row);
    });
    sidebar.append(list);
    container.replaceChildren(shell);
  };
  render();
  return true;
}
